-- Pure hoof simulation: generates a hoof, applies tool strokes, scores results.
-- No Roblox APIs here so it runs (and is tested) in plain Lua.

local Config = require(script.Parent.Config)

local HoofSim = {}

local W, H = Config.GRID_W, Config.GRID_H

local function clamp(v, lo, hi)
	if v < lo then return lo elseif v > hi then return hi end
	return v
end

-- Tiny deterministic PRNG (LCG) so a level always generates the same hoof.
local function newRng(seed)
	local s = seed % 2147483647
	if s <= 0 then s = s + 2147483646 end
	return function()
		s = (s * 16807) % 2147483647
		return s / 2147483647
	end
end

function HoofSim.index(x, y)
	return y * W + x + 1
end

-- Heel is at the top, toe at the bottom, frog is the V pointing at the toe.
local function classify(x, y)
	local cx, cy = (W - 1) / 2, (H - 1) / 2 + 0.5
	local rx, ry = W / 2 - 0.4, H / 2 - 0.4
	local u, v = (x - cx) / rx, (y - cy) / ry
	local r2 = u * u + v * v
	if r2 > 1 then return nil end
	local r = math.sqrt(r2)
	if r >= 0.86 then return "wall" end
	if v >= -0.78 and v <= 0.5 then
		local halfWidth = 0.32 * (0.5 - v) / 1.28
		if math.abs(u) <= halfWidth then return "frog" end
	end
	return "sole"
end

local function noise(x, y, a, b)
	return 0.5 + 0.5 * math.sin(x * 0.55 + a) * math.cos(y * 0.45 + b)
end

function HoofSim.newState(level, upgrades)
	local rng = newRng(level.seed or 1)
	local a, b = rng() * 6.28, rng() * 6.28
	local hasRasp, hasDressing = false, false
	for _, id in ipairs(level.tools) do
		if id == "Rasp" then hasRasp = true end
		if id == "Dressing" then hasDressing = true end
	end

	local state = {
		level = level, cells = {}, inside = {},
		comfort = Config.MAX_COMFORT, elapsed = 0,
		hasRasp = hasRasp, hasDressing = hasDressing,
		patCooldown = 0, patAmount = Config.patAmount(upgrades),
		flinch = "idle", flinchTimer = 0, flinchHit = false,
		nextFlinch = (level.flinch or 0) > 0 and (level.flinch * (0.6 + rng() * 0.8)) or math.huge,
		rng = rng,
	}

	local frogCells = {}
	for y = 0, H - 1 do
		for x = 0, W - 1 do
			local kind = classify(x, y)
			if kind then
				local n = noise(x, y, a, b)
				local excess = 0
				local base = (kind == "frog" and level.frog) or (kind == "sole" and level.sole) or level.wall
				if base > 0 then
					excess = base * (0.35 + 0.9 * (0.6 * n + 0.4 * rng()))
					if excess < 0.3 then excess = 0 end
				end
				local cell = {
					x = x, y = y, kind = kind,
					dirt = math.max(0.34, level.dirt * (0.4 + 0.6 * n)),
					excess = excess, initialExcess = excess,
					rough = 0, thrush = false, needsDress = false, treated = false,
					sore = 0, grace = 1,
				}
				local i = HoofSim.index(x, y)
				state.cells[i] = cell
				state.inside[#state.inside + 1] = i
				if kind == "frog" and y > 6 and y < H - 8 then frogCells[#frogCells + 1] = i end
			end
		end
	end

	-- Thrush patches live in the frog.
	local patches = hasDressing and (level.thrush or 0) or 0
	for _ = 1, patches do
		if #frogCells == 0 then break end
		local c = state.cells[frogCells[math.floor(rng() * #frogCells) + 1]]
		for _, i in ipairs(state.inside) do
			local o = state.cells[i]
			if o.kind ~= "wall" and (o.x - c.x) ^ 2 + (o.y - c.y) ^ 2 <= 2.2 then
				if not o.thrush then
					o.thrush = true
					o.excess = o.excess + 1
					o.initialExcess = o.excess
				end
			end
		end
	end

	local total = 0
	for _, i in ipairs(state.inside) do
		local c = state.cells[i]
		total = total + c.dirt + c.excess
		if c.thrush then total = total + 1 end
		if hasRasp and c.initialExcess > 0 then total = total + 1 end
	end
	state.total = total
	return state
end

-- Work left (dirt + excess + rough + untreated thrush), in the same units as total.
function HoofSim.remaining(state)
	local r = 0
	for _, i in ipairs(state.inside) do
		local c = state.cells[i]
		r = r + c.dirt + c.excess + c.rough
		if c.thrush or c.needsDress then r = r + 1 end
	end
	return r
end

function HoofSim.progress(state)
	return clamp(1 - HoofSim.remaining(state) / state.total, 0, 1)
end

function HoofSim.isComplete(state)
	return HoofSim.remaining(state) <= 1e-6
end

local function finishCut(state, c)
	-- Called when a cell's excess hits zero.
	if c.thrush then
		c.thrush = false
		c.needsDress = true
	end
	if state.hasRasp then c.rough = 1 end
end

-- Apply one tool hit centred on grid position (gx, gy).
-- Returns: changed (list of cell indices), comfortDelta, info {blocked, flinched}.
function HoofSim.apply(state, toolId, gx, gy, stats)
	local changed, seen = {}, {}
	local info = { blocked = false, flinched = false }
	local penalty = 0
	local radius, power = stats.radius, stats.power
	local tender = state.level.tender or 1

	local function mark(i)
		if not seen[i] then seen[i] = true; changed[#changed + 1] = i end
	end

	-- A hit while the horse is mid-flinch hurts once and ruins the stroke.
	if state.flinch == "active" then
		if not state.flinchHit then
			state.flinchHit = true
			info.flinched = true
			state.comfort = clamp(state.comfort - 6 * tender, 0, Config.MAX_COMFORT)
			return changed, -6 * tender, info
		end
		return changed, 0, info
	end

	local nipperTargets, nipperClean = 0, 0
	local x0, x1 = math.max(0, math.floor(gx - radius)), math.min(W - 1, math.ceil(gx + radius))
	local y0, y1 = math.max(0, math.floor(gy - radius)), math.min(H - 1, math.ceil(gy + radius))
	for y = y0, y1 do
		for x = x0, x1 do
			local i = HoofSim.index(x, y)
			local c = state.cells[i]
			local d = c and math.sqrt((x - gx) ^ 2 + (y - gy) ^ 2)
			if c and d <= radius then
				local w = 1 - 0.5 * d / radius
				if toolId == "Pick" then
					if c.dirt > 0 then
						c.dirt = math.max(0, c.dirt - power * w)
						mark(i)
					end
				elseif toolId == "Knife" then
					if c.kind ~= "wall" then
						if c.dirt > 0 then
							info.blocked = true
						elseif c.excess > 0 then
							c.excess = math.max(0, c.excess - power * w)
							if c.excess == 0 then finishCut(state, c) end
							mark(i)
						elseif c.grace > 0 then
							c.grace = c.grace - power * w
						elseif c.sore < 1 then
							local ds = math.min(1 - c.sore, 0.34 * w)
							c.sore = c.sore + ds
							penalty = penalty + 0.6 * tender * ds * (c.kind == "frog" and 1.3 or 0.8)
							mark(i)
						end
					end
				elseif toolId == "Nippers" then
					if c.kind == "wall" then
						if c.dirt > 0 then
							info.blocked = true
						elseif c.excess > 0 then
							nipperTargets = nipperTargets + 1
							c.excess = math.max(0, c.excess - power * w)
							if c.excess == 0 then finishCut(state, c) end
							mark(i)
						else
							nipperClean = nipperClean + 1
						end
					end
				elseif toolId == "Rasp" then
					if c.dirt > 0 then
						info.blocked = true
					elseif c.rough > 0 then
						c.rough = math.max(0, c.rough - power * w)
						mark(i)
					elseif c.excess > 0 and c.kind ~= "frog" then
						-- Rasping overgrowth works, just very slowly.
						c.excess = math.max(0, c.excess - 0.12 * power * w)
						if c.excess == 0 then finishCut(state, c) end
						mark(i)
					end
				elseif toolId == "Dressing" then
					if c.needsDress then
						c.needsDress = false
						c.treated = true
						mark(i)
					end
				end
			end
		end
	end

	if toolId == "Nippers" and nipperTargets == 0 and nipperClean > 0 then
		penalty = penalty + 2 * tender
	end

	if penalty > 0 then
		state.comfort = clamp(state.comfort - penalty, 0, Config.MAX_COMFORT)
	end
	return changed, -penalty, info
end

-- Advance timers. Returns an event string when the flinch state changes.
function HoofSim.update(state, dt)
	state.elapsed = state.elapsed + dt
	if state.patCooldown > 0 then state.patCooldown = math.max(0, state.patCooldown - dt) end

	if state.flinch == "idle" then
		state.nextFlinch = state.nextFlinch - dt
		if state.nextFlinch <= 0 then
			state.flinch, state.flinchTimer, state.flinchHit = "warn", 1.1, false
			return "warn"
		end
	else
		state.flinchTimer = state.flinchTimer - dt
		if state.flinchTimer <= 0 then
			if state.flinch == "warn" then
				state.flinch, state.flinchTimer = "active", 0.9
				return "active"
			else
				state.flinch = "idle"
				local f = state.level.flinch
				state.nextFlinch = f * (0.6 + state.rng() * 0.8)
				return "idle"
			end
		end
	end
	return nil
end

-- Pat the horse: restores comfort and calms an incoming flinch.
function HoofSim.pat(state)
	if state.patCooldown > 0 then return false end
	state.patCooldown = Config.PAT_COOLDOWN
	state.comfort = clamp(state.comfort + state.patAmount, 0, Config.MAX_COMFORT)
	if state.flinch == "warn" then
		state.flinch = "idle"
		state.nextFlinch = state.level.flinch * (0.8 + state.rng() * 0.6)
	end
	return true
end

-- Stars + coin reward. Shared so the server can recompute them.
function HoofSim.grade(level, progress, comfort, time)
	if progress < Config.FINISH_AT or comfort <= 0 then
		return 0, 0
	end
	local stars = 1
	if progress >= 0.98 and comfort >= 50 then stars = 2 end
	if progress >= 0.995 and comfort >= 75 and time <= level.par then stars = 3 end
	local coins = math.floor(level.coins * (0.5 + 0.5 * stars))
	return stars, coins
end

return HoofSim
