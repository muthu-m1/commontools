-- Shared tuning for Hoof Trimmer: grid size, tools, upgrades and levels.
-- Plain Lua on purpose so the logic can be unit-tested outside Roblox.

local Config = {}

Config.GRID_W = 26
Config.GRID_H = 34

Config.MAX_COMFORT = 100
Config.FINISH_AT = 0.92 -- progress needed before the Finish button unlocks
Config.PAT_COOLDOWN = 6
Config.PAT_AMOUNT = 12

-- Order here = hotbar order (keys 1-5).
Config.Tools = {
	{ id = "Pick", name = "Hoof Pick", icon = "⛏", radius = 1.7, power = 0.45, cooldown = 0.03,
		hint = "Scrub the packed dirt out of the hoof." },
	{ id = "Knife", name = "Hoof Knife", icon = "🔪", radius = 1.5, power = 0.5, cooldown = 0.04,
		hint = "Peel frog flaps & chalky sole. Don't cut clean spots!" },
	{ id = "Nippers", name = "Nippers", icon = "✂", radius = 2.4, power = 1.0, cooldown = 0.3, click = true,
		hint = "Click to snip overgrown wall." },
	{ id = "Rasp", name = "Rasp", icon = "📏", radius = 2.2, power = 0.5, cooldown = 0.04,
		hint = "Smooth rough spots. Slow but safe." },
	{ id = "Dressing", name = "Dressing", icon = "🧴", radius = 2.0, power = 1.0, cooldown = 0.05,
		hint = "Paint cleaned thrush spots with dressing." },
}

Config.ToolById = {}
for _, t in ipairs(Config.Tools) do
	Config.ToolById[t.id] = t
end

-- Shop upgrades. Each level adds `perLevel` to the stat multiplier.
Config.Upgrades = {
	{ id = "PickPower", name = "Sturdy Pick", desc = "Pick digs dirt faster.", tool = "Pick", stat = "power", perLevel = 0.25, baseCost = 40 },
	{ id = "KnifeEdge", name = "Razor Knife", desc = "Knife peels faster.", tool = "Knife", stat = "power", perLevel = 0.2, baseCost = 60 },
	{ id = "NipperReach", name = "Long Nippers", desc = "Nippers snip a wider area.", tool = "Nippers", stat = "radius", perLevel = 0.2, baseCost = 80 },
	{ id = "RaspGrit", name = "Coarse Rasp", desc = "Rasp smooths faster.", tool = "Rasp", stat = "power", perLevel = 0.3, baseCost = 50 },
	{ id = "Treats", name = "Horse Treats", desc = "Pats calm the horse more.", stat = "pat", perLevel = 0.25, baseCost = 70 },
}
Config.MAX_UPGRADE_LEVEL = 5
Config.UpgradeById = {}
for _, u in ipairs(Config.Upgrades) do
	Config.UpgradeById[u.id] = u
end

function Config.upgradeCost(id, level)
	local u = Config.UpgradeById[id]
	return math.floor(u.baseCost * (1 + level) * 1.5)
end

-- Effective stats for a tool given the player's upgrade levels.
function Config.toolStats(toolId, upgrades)
	local base = Config.ToolById[toolId]
	local radius, power = base.radius, base.power
	for _, u in ipairs(Config.Upgrades) do
		local lvl = (upgrades and upgrades[u.id]) or 0
		if u.tool == toolId and lvl > 0 then
			if u.stat == "power" then
				power = power * (1 + u.perLevel * lvl)
			elseif u.stat == "radius" then
				radius = radius * (1 + u.perLevel * lvl * 0.5)
			end
		end
	end
	return { radius = radius, power = power, cooldown = base.cooldown, click = base.click == true }
end

function Config.patAmount(upgrades)
	local lvl = (upgrades and upgrades.Treats) or 0
	return Config.PAT_AMOUNT * (1 + Config.UpgradeById.Treats.perLevel * lvl)
end

-- Level fields:
--   dirt/frog/sole/wall: starting layers of dirt / excess to remove
--   thrush: number of thrush patches   tender: pain multiplier for mistakes
--   flinch: avg seconds between flinches (0 = calm horse)   par: 3-star time
Config.Levels = {
	{ name = "Pony Pedicure", horse = "Biscuit the Pony", dirt = 1, frog = 1, sole = 0, wall = 0, thrush = 0, tender = 0.8, flinch = 0, par = 75, coins = 20, seed = 11, tools = { "Pick", "Knife" } },
	{ name = "Shetland Shine", horse = "Pip the Shetland", dirt = 2, frog = 1, sole = 1, wall = 0, thrush = 0, tender = 0.9, flinch = 0, par = 85, coins = 25, seed = 22, tools = { "Pick", "Knife", "Rasp" } },
	{ name = "Quarter Horse Care", horse = "Dusty", dirt = 2, frog = 2, sole = 1, wall = 1, thrush = 0, tender = 1.0, flinch = 16, par = 95, coins = 32, seed = 33, tools = { "Pick", "Knife", "Nippers", "Rasp" } },
	{ name = "Thrush Trouble", horse = "Clover", dirt = 2, frog = 2, sole = 1, wall = 1, thrush = 2, tender = 1.0, flinch = 14, par = 105, coins = 40, seed = 44, tools = { "Pick", "Knife", "Nippers", "Rasp", "Dressing" } },
	{ name = "Mustang Mess", horse = "Ember", dirt = 3, frog = 2, sole = 2, wall = 1, thrush = 2, tender = 1.1, flinch = 12, par = 115, coins = 50, seed = 55, tools = { "Pick", "Knife", "Nippers", "Rasp", "Dressing" } },
	{ name = "Clydesdale Cleanup", horse = "Duke", dirt = 3, frog = 3, sole = 2, wall = 2, thrush = 2, tender = 1.1, flinch = 12, par = 130, coins = 60, seed = 66, tools = { "Pick", "Knife", "Nippers", "Rasp", "Dressing" } },
	{ name = "Stubborn Mule", horse = "Gus the Mule", dirt = 3, frog = 3, sole = 2, wall = 2, thrush = 3, tender = 1.4, flinch = 9, par = 130, coins = 75, seed = 77, tools = { "Pick", "Knife", "Nippers", "Rasp", "Dressing" } },
	{ name = "Racehorse Rush", horse = "Lightning", dirt = 3, frog = 2, sole = 2, wall = 2, thrush = 2, tender = 1.5, flinch = 10, par = 95, coins = 90, seed = 88, tools = { "Pick", "Knife", "Nippers", "Rasp", "Dressing" } },
	{ name = "Wild Stallion", horse = "Shadow", dirt = 3, frog = 3, sole = 3, wall = 2, thrush = 3, tender = 1.6, flinch = 6, par = 140, coins = 110, seed = 99, tools = { "Pick", "Knife", "Nippers", "Rasp", "Dressing" } },
	{ name = "Hoof Master", horse = "The Legend", dirt = 3, frog = 3, sole = 3, wall = 3, thrush = 4, tender = 1.8, flinch = 5, par = 150, coins = 150, seed = 123, tools = { "Pick", "Knife", "Nippers", "Rasp", "Dressing" } },
}

return Config
