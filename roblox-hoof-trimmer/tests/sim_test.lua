local fails = 0
local function check(cond, msg)
	if cond then print("ok   " .. msg) else print("FAIL " .. msg); fails = fails + 1 end
end

local function perfectRun(level)
	local st = HoofSim.newState(level, {})
	-- Sweep every tool across the whole grid, in video order.
	for _, tool in ipairs({ "Pick", "Knife", "Nippers", "Rasp", "Dressing" }) do
		local have = false
		for _, id in ipairs(level.tools) do if id == tool then have = true end end
		if have then
			local stats = Config.toolStats(tool, {})
			for pass = 1, 40 do
				for y = 0, Config.GRID_H - 1, 1 do
					for x = 0, Config.GRID_W - 1, 1 do
						local c = st.cells[HoofSim.index(x, y)]
						-- only aim where the tool has work (a skilled player)
						local need = (tool == "Pick" and c and c.dirt > 0)
							or (tool == "Knife" and c and c.kind ~= "wall" and c.dirt == 0 and c.excess > 0)
							or (tool == "Nippers" and c and c.kind == "wall" and c.dirt == 0 and c.excess > 0)
							or (tool == "Rasp" and c and c.dirt == 0 and c.rough > 0)
							or (tool == "Dressing" and c and c.needsDress)
						if need then HoofSim.apply(st, tool, x, y, stats) end
					end
				end
			end
		end
	end
	return st
end

for n, level in ipairs(Config.Levels) do
	local st = perfectRun(level)
	check(HoofSim.isComplete(st), ("level %d (%s) is completable"):format(n, level.name))
	check(st.comfort > 20, ("level %d precise play keeps comfort (%.0f)"):format(n, st.comfort))
	local stars = HoofSim.grade(level, HoofSim.progress(st), st.comfort, level.par)
	check(stars >= 1, ("level %d earns stars"):format(n))
end

-- Same seed -> same hoof
local a, b = HoofSim.newState(Config.Levels[3], {}), HoofSim.newState(Config.Levels[3], {})
check(a.total == b.total, "generation is deterministic")

-- Knife is blocked by dirt
local st = HoofSim.newState(Config.Levels[1], {})
local frog
for _, i in ipairs(st.inside) do if st.cells[i].kind == "frog" and st.cells[i].excess > 0 then frog = st.cells[i] break end end
HoofSim.apply(st, "Knife", frog.x, frog.y, Config.toolStats("Knife", {}))
check(frog.excess == frog.initialExcess, "knife does nothing through dirt")

-- Cutting clean cells hurts (after grace)
local st2 = HoofSim.newState(Config.Levels[1], {})
for _, i in ipairs(st2.inside) do st2.cells[i].dirt = 0 end
local sole
for _, i in ipairs(st2.inside) do if st2.cells[i].kind == "sole" then sole = st2.cells[i] break end end
for _ = 1, 60 do HoofSim.apply(st2, "Knife", sole.x, sole.y, Config.toolStats("Knife", {})) end
check(st2.comfort < 100, "overcutting costs comfort")
check(st2.comfort > 0, "overcut penalty is bounded per cell")

-- Flinch: warn -> active -> idle, pat cancels warn
local st3 = HoofSim.newState(Config.Levels[9], {})
st3.nextFlinch = 0.01
check(HoofSim.update(st3, 0.1) == "warn", "flinch warns first")
check(HoofSim.pat(st3) and st3.flinch == "idle", "pat calms a warned flinch")
st3.nextFlinch = 0.01
HoofSim.update(st3, 0.1); HoofSim.update(st3, 1.2)
check(st3.flinch == "active", "flinch becomes active")
local _, d, info = HoofSim.apply(st3, "Pick", 10, 10, Config.toolStats("Pick", {}))
check(info.flinched and d < 0, "working during a flinch hurts")

-- Grading
local l = Config.Levels[1]
check(select(1, HoofSim.grade(l, 1, 100, l.par - 1)) == 3, "perfect = 3 stars")
check(select(1, HoofSim.grade(l, 0.5, 100, 10)) == 0, "unfinished = 0 stars")
check(select(1, HoofSim.grade(l, 0.95, 60, 10)) == 1, "sloppy = 1 star")

print(fails == 0 and "ALL PASSED" or (fails .. " FAILED"))
if fails > 0 then error("tests failed") end
