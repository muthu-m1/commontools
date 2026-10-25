-- Server: persistence (DataStore), shop purchases and level-result validation.
-- Gameplay itself runs on the client; the server owns coins, unlocks and upgrades.

local Players = game:GetService("Players")
local ReplicatedStorage = game:GetService("ReplicatedStorage")
local DataStoreService = game:GetService("DataStoreService")
local Workspace = game:GetService("Workspace")

local Shared = ReplicatedStorage:WaitForChild("Shared")
local Config = require(Shared:WaitForChild("Config"))
local HoofSim = require(Shared:WaitForChild("HoofSim"))

local store = DataStoreService:GetDataStore("HoofTrimmerV1")

-- Remotes ---------------------------------------------------------------
local remotes = Instance.new("Folder")
remotes.Name = "HoofRemotes"
remotes.Parent = ReplicatedStorage

local function newFunction(name)
	local f = Instance.new("RemoteFunction")
	f.Name = name
	f.Parent = remotes
	return f
end
local getProfile = newFunction("GetProfile")
local submitLevel = newFunction("SubmitLevel")
local buyUpgrade = newFunction("BuyUpgrade")

-- A tiny backdrop so the (hidden) character has somewhere to stand.
local base = Instance.new("Part")
base.Name = "Base"
base.Anchored = true
base.Size = Vector3.new(64, 1, 64)
base.Position = Vector3.new(0, -0.5, 0)
base.Parent = Workspace
local spawn = Instance.new("SpawnLocation")
spawn.Anchored = true
spawn.Position = Vector3.new(0, 0.5, 0)
spawn.Transparency = 1
spawn.CanCollide = false
spawn.Parent = Workspace

-- Profiles --------------------------------------------------------------
local profiles = {} -- [Player] = profile
local lastCall = {} -- [Player] = os.clock() of last remote call

local function defaultProfile()
	return { coins = 0, unlocked = 1, stars = {}, upgrades = {} }
end

local function sanitize(raw)
	local p = defaultProfile()
	if typeof(raw) ~= "table" then return p end
	p.coins = math.max(0, tonumber(raw.coins) or 0)
	p.unlocked = math.clamp(tonumber(raw.unlocked) or 1, 1, #Config.Levels)
	for i = 1, #Config.Levels do
		p.stars[tostring(i)] = math.clamp((raw.stars and tonumber(raw.stars[tostring(i)])) or 0, 0, 3)
	end
	for _, u in ipairs(Config.Upgrades) do
		p.upgrades[u.id] = math.clamp((raw.upgrades and tonumber(raw.upgrades[u.id])) or 0, 0, Config.MAX_UPGRADE_LEVEL)
	end
	return p
end

local function loadProfile(player)
	local ok, data = pcall(function()
		return store:GetAsync("p_" .. player.UserId)
	end)
	if not ok then
		warn("[HoofTrimmer] load failed (progress won't save this session):", data)
	end
	profiles[player] = sanitize(ok and data or nil)
	profiles[player]._canSave = ok
end

local function save(player)
	local p = profiles[player]
	if not p or not p._canSave then return end
	local copy = { coins = p.coins, unlocked = p.unlocked, stars = p.stars, upgrades = p.upgrades }
	local ok, err = pcall(function()
		store:SetAsync("p_" .. player.UserId, copy)
	end)
	if not ok then warn("[HoofTrimmer] save failed:", err) end
end

local function throttled(player)
	local now = os.clock()
	if lastCall[player] and now - lastCall[player] < 0.25 then return true end
	lastCall[player] = now
	return false
end

local function publicProfile(p)
	return { coins = p.coins, unlocked = p.unlocked, stars = p.stars, upgrades = p.upgrades }
end

-- Remote handlers -------------------------------------------------------
getProfile.OnServerInvoke = function(player)
	-- Wait briefly for the DataStore load to finish.
	local t = 0
	while not profiles[player] and t < 10 do
		task.wait(0.1)
		t += 0.1
	end
	return profiles[player] and publicProfile(profiles[player]) or publicProfile(defaultProfile())
end

submitLevel.OnServerInvoke = function(player, levelIndex, progress, comfort, time)
	local p = profiles[player]
	if not p or throttled(player) then return nil end
	if typeof(levelIndex) ~= "number" or typeof(progress) ~= "number"
		or typeof(comfort) ~= "number" or typeof(time) ~= "number" then
		return nil
	end
	levelIndex = math.floor(levelIndex)
	local level = Config.Levels[levelIndex]
	if not level or levelIndex > p.unlocked then return nil end

	progress = math.clamp(progress, 0, 1)
	comfort = math.clamp(comfort, 0, Config.MAX_COMFORT)
	-- Reject impossibly fast clears (cheap sanity check, not real anti-cheat).
	if time < level.par * 0.15 then return nil end

	local stars, coins = HoofSim.grade(level, progress, comfort, time)
	local key = tostring(levelIndex)
	local best = p.stars[key] or 0
	if stars > 0 then
		-- Replays pay out, but only a fraction once the level is 3-starred.
		if best >= 3 then coins = math.floor(coins * 0.5) end
		p.coins += coins
		if stars > best then p.stars[key] = stars end
		if levelIndex == p.unlocked and p.unlocked < #Config.Levels then
			p.unlocked += 1
		end
	end
	return { stars = stars, coins = coins, profile = publicProfile(p) }
end

buyUpgrade.OnServerInvoke = function(player, id)
	local p = profiles[player]
	if not p or throttled(player) or typeof(id) ~= "string" then return nil end
	local u = Config.UpgradeById[id]
	if not u then return nil end
	local lvl = p.upgrades[id] or 0
	if lvl >= Config.MAX_UPGRADE_LEVEL then return nil end
	local cost = Config.upgradeCost(id, lvl)
	if p.coins < cost then return nil end
	p.coins -= cost
	p.upgrades[id] = lvl + 1
	return publicProfile(p)
end

-- Lifecycle -------------------------------------------------------------
Players.PlayerAdded:Connect(loadProfile)
for _, pl in ipairs(Players:GetPlayers()) do task.spawn(loadProfile, pl) end

Players.PlayerRemoving:Connect(function(player)
	save(player)
	profiles[player] = nil
	lastCall[player] = nil
end)

game:BindToClose(function()
	for _, pl in ipairs(Players:GetPlayers()) do save(pl) end
end)

task.spawn(function()
	while true do
		task.wait(60)
		for _, pl in ipairs(Players:GetPlayers()) do save(pl) end
	end
end)
