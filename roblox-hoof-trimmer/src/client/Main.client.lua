-- Client: menus, shop, HUD, input and the game loop for Hoof Trimmer.

local Players = game:GetService("Players")
local ReplicatedStorage = game:GetService("ReplicatedStorage")
local RunService = game:GetService("RunService")
local UserInputService = game:GetService("UserInputService")
local StarterGui = game:GetService("StarterGui")
local SoundService = game:GetService("SoundService")
local Debris = game:GetService("Debris")

local Shared = ReplicatedStorage:WaitForChild("Shared")
local Config = require(Shared:WaitForChild("Config"))
local HoofSim = require(Shared:WaitForChild("HoofSim"))
local Ui = require(script.Parent.Ui)
local HoofView = require(script.Parent.HoofView)
local C = Ui.Color

local remotes = ReplicatedStorage:WaitForChild("HoofRemotes")
local player = Players.LocalPlayer

pcall(function()
	StarterGui:SetCoreGuiEnabled(Enum.CoreGuiType.All, false)
end)

local profile = remotes.GetProfile:InvokeServer()

local gui = Ui.new("ScreenGui", {
	Name = "HoofGame", ResetOnSpawn = false, ZIndexBehavior = Enum.ZIndexBehavior.Sibling,
}, player:WaitForChild("PlayerGui"))

-- Sound -------------------------------------------------------------------
local lastSfx = {}
local function sfx(id, volume, pitch, minGap)
	local now = os.clock()
	if lastSfx[id] and now - lastSfx[id] < (minGap or 0) then return end
	lastSfx[id] = now
	local s = Instance.new("Sound")
	s.SoundId = id
	s.Volume = volume or 0.5
	s.PlaybackSpeed = pitch or 1
	s.Parent = SoundService
	s:Play()
	Debris:AddItem(s, 3)
end
local SFX = {
	scrape = "rbxasset://sounds/clickfast.wav",
	snap = "rbxasset://sounds/snap.mp3",
	ouch = "rbxasset://sounds/uuhhh.mp3",
	ding = "rbxasset://sounds/electronicpingshort.wav",
}
local BURST_COLOR = {
	Pick = Color3.fromRGB(120, 94, 68), Knife = Color3.fromRGB(246, 238, 224),
	Nippers = Color3.fromRGB(70, 60, 54), Rasp = Color3.fromRGB(255, 252, 245),
	Dressing = Color3.fromRGB(110, 150, 220),
}

-- Screens -----------------------------------------------------------------
local view = HoofView.new(gui)

local menu = Ui.new("Frame", { Size = UDim2.fromScale(1, 1), BackgroundColor3 = C.bg, BorderSizePixel = 0 }, gui)
Ui.new("UIGradient", { Rotation = 90, Color = ColorSequence.new(Color3.fromRGB(58, 44, 36), Color3.fromRGB(28, 22, 20)) }, menu)
Ui.label(menu, "🐴 Hoof Trimmer", 46, { Position = UDim2.fromScale(0.5, 0.06), AnchorPoint = Vector2.new(0.5, 0), Size = UDim2.fromOffset(600, 60) })
Ui.label(menu, "Pick it clean. Trim it neat. Keep the horse calm.", 20, { Position = UDim2.fromScale(0.5, 0.15), AnchorPoint = Vector2.new(0.5, 0), Size = UDim2.fromOffset(700, 30), TextColor3 = C.dim, Font = Enum.Font.Gotham })
local coinsLabel = Ui.label(menu, "", 24, { Position = UDim2.new(1, -20, 0, 14), AnchorPoint = Vector2.new(1, 0), Size = UDim2.fromOffset(220, 36), TextColor3 = C.gold, TextXAlignment = Enum.TextXAlignment.Right })
local shopBtn
local grid = Ui.new("ScrollingFrame", {
	Position = UDim2.fromScale(0.5, 0.24), AnchorPoint = Vector2.new(0.5, 0), Size = UDim2.new(0.9, 0, 0.62, 0),
	BackgroundTransparency = 1, BorderSizePixel = 0, ScrollBarThickness = 6,
	CanvasSize = UDim2.new(), AutomaticCanvasSize = Enum.AutomaticSize.Y,
}, menu)
Ui.new("UIGridLayout", { CellSize = UDim2.fromOffset(190, 118), CellPadding = UDim2.fromOffset(14, 14), HorizontalAlignment = Enum.HorizontalAlignment.Center, SortOrder = Enum.SortOrder.LayoutOrder }, grid)

local shop = Ui.panel(gui, { Size = UDim2.fromOffset(520, 440), Position = UDim2.fromScale(0.5, 0.5), AnchorPoint = Vector2.new(0.5, 0.5), Visible = false, ZIndex = 50 })
local shopList = Ui.new("Frame", { Position = UDim2.fromOffset(16, 64), Size = UDim2.new(1, -32, 1, -128), BackgroundTransparency = 1, ZIndex = 51 }, shop)
Ui.new("UIListLayout", { Padding = UDim.new(0, 8) }, shopList)
Ui.label(shop, "🛒 Tool Shop", 28, { Position = UDim2.fromOffset(16, 12), Size = UDim2.new(1, -32, 0, 40), ZIndex = 51 })

local hud = Ui.new("Frame", { Size = UDim2.fromScale(1, 1), BackgroundTransparency = 1, Visible = false, ZIndex = 30 }, gui)
local result = Ui.panel(gui, { Size = UDim2.fromOffset(440, 340), Position = UDim2.fromScale(0.5, 0.5), AnchorPoint = Vector2.new(0.5, 0.5), Visible = false, ZIndex = 60 })

-- HUD ---------------------------------------------------------------------
local topBar = Ui.panel(hud, { Position = UDim2.fromOffset(10, 6), Size = UDim2.new(1, -20, 0, 66), ZIndex = 31 })
local titleLabel = Ui.label(topBar, "", 18, { Position = UDim2.fromScale(0.01, 0), Size = UDim2.fromScale(0.27, 1), TextXAlignment = Enum.TextXAlignment.Left, ZIndex = 32 })
local function column(x, w, caption)
	Ui.label(topBar, caption, 13, { Position = UDim2.fromScale(x, 0.06), Size = UDim2.fromScale(w, 0.3), TextColor3 = C.dim, ZIndex = 32 })
	local frame, set = Ui.bar(topBar, { Position = UDim2.fromScale(x, 0.45), Size = UDim2.fromScale(w, 0.38), ZIndex = 32 }, C.accent)
	frame.ZIndex = 32
	local txt = Ui.label(frame, "", 14, { Size = UDim2.fromScale(1, 1), ZIndex = 34 })
	return set, txt
end
local setProgress, progressText = column(0.29, 0.22, "PROGRESS")
local setComfort, comfortText = column(0.53, 0.22, "HORSE COMFORT")
local timeLabel = Ui.label(topBar, "", 18, { Position = UDim2.fromScale(0.77, 0), Size = UDim2.fromScale(0.12, 1), ZIndex = 32 })
local exitBtn = Ui.button(topBar, "Exit", 16, { Position = UDim2.fromScale(0.9, 0.18), Size = UDim2.fromScale(0.09, 0.64), ZIndex = 32 })

local toolPanel = Ui.new("Frame", { Position = UDim2.fromOffset(10, 84), Size = UDim2.fromOffset(170, 300), BackgroundTransparency = 1, ZIndex = 31 }, hud)
Ui.new("UIListLayout", { Padding = UDim.new(0, 8) }, toolPanel)
local hintLabel = Ui.label(hud, "", 18, { Position = UDim2.new(0.5, 0, 1, -14), AnchorPoint = Vector2.new(0.5, 1), Size = UDim2.fromOffset(640, 30), ZIndex = 31, TextStrokeTransparency = 0.6 })
local banner = Ui.label(hud, "", 24, { Position = UDim2.new(0.5, 0, 0, 84), AnchorPoint = Vector2.new(0.5, 0), Size = UDim2.fromOffset(700, 40), TextColor3 = C.warn, TextStrokeTransparency = 0.4, ZIndex = 31 })
local patBtn = Ui.button(hud, "", 18, { Position = UDim2.new(1, -14, 1, -14), AnchorPoint = Vector2.new(1, 1), Size = UDim2.fromOffset(190, 52), ZIndex = 31 })
local finishBtn = Ui.button(hud, "✔ Finish", 20, { Position = UDim2.new(1, -14, 1, -76), AnchorPoint = Vector2.new(1, 1), Size = UDim2.fromOffset(190, 52), BackgroundColor3 = C.accent, Visible = false, ZIndex = 31 })

-- Game state --------------------------------------------------------------
local state, levelIndex, level
local playing, holding = false, false
local tool
local lastHit, lastProgressCheck, bannerToken = 0, 0, 0
local toolButtons = {}

local function showBanner(text, seconds, color)
	bannerToken += 1
	local token = bannerToken
	banner.Text = text
	banner.TextColor3 = color or C.warn
	task.delay(seconds or 1.5, function()
		if bannerToken == token then banner.Text = "" end
	end)
end

local function selectTool(id)
	tool = id
	for tid, b in pairs(toolButtons) do
		b.BackgroundColor3 = (tid == id) and C.accent or C.panelLight
	end
	hintLabel.Text = Config.ToolById[id].hint
end

local function buildToolButtons()
	for _, b in pairs(toolButtons) do b:Destroy() end
	toolButtons = {}
	for n, id in ipairs(level.tools) do
		local t = Config.ToolById[id]
		toolButtons[id] = Ui.button(toolPanel, ("[%d] %s %s"):format(n, t.icon, t.name), 17, {
			Size = UDim2.fromOffset(170, 46), ZIndex = 32, LayoutOrder = n,
		}, function() selectTool(id) end)
	end
end

local function starString(n)
	return string.rep("★", n) .. string.rep("☆", 3 - n)
end

local function updateCoins()
	coinsLabel.Text = "🪙 " .. tostring(profile.coins)
end

local showMenu, startLevel

local function showResult(success, text, stars, coins)
	for _, ch in ipairs(result:GetChildren()) do
		if not ch:IsA("UICorner") then ch:Destroy() end
	end
	Ui.label(result, success and "Hoof Trimmed! 🎉" or "Oh no…", 32, { Position = UDim2.fromOffset(20, 14), Size = UDim2.new(1, -40, 0, 44), ZIndex = 61, TextColor3 = success and C.accent or C.bad })
	Ui.label(result, starString(stars), 54, { Position = UDim2.fromOffset(20, 62), Size = UDim2.new(1, -40, 0, 64), ZIndex = 61, TextColor3 = C.gold })
	Ui.label(result, text, 18, { Position = UDim2.fromOffset(24, 130), Size = UDim2.new(1, -48, 0, 100), ZIndex = 61, TextColor3 = C.dim, Font = Enum.Font.Gotham })
	if coins > 0 then
		Ui.label(result, "+" .. coins .. " 🪙", 28, { Position = UDim2.fromOffset(20, 224), Size = UDim2.new(1, -40, 0, 36), ZIndex = 61, TextColor3 = C.gold })
	end
	local x = 20
	local function btn(label, color, fn)
		Ui.button(result, label, 18, { Position = UDim2.new(0, x, 1, -66), Size = UDim2.fromOffset(125, 48), BackgroundColor3 = color, ZIndex = 61 }, fn)
		x += 138
	end
	btn("↻ Retry", C.panelLight, function() startLevel(levelIndex) end)
	if success and levelIndex < #Config.Levels then
		btn("Next ▶", C.accent, function() startLevel(levelIndex + 1) end)
	end
	btn("Menu", C.panelLight, showMenu)
	result.Visible = true
end

local function finish(success)
	if not playing then return end
	playing, holding = false, false
	view:setCursor(nil)
	view:setShake(0)
	hud.Visible = false

	local progress = HoofSim.progress(state)
	local pct = math.floor(progress * 100)
	local summary = ("Time %ds (par %ds)\nComfort %d%%   Complete %d%%"):format(math.floor(state.elapsed), level.par, math.floor(state.comfort), pct)

	if not success then
		showResult(false, "The horse pulled its foot away!\n" .. summary, 0, 0)
		return
	end
	local res = remotes.SubmitLevel:InvokeServer(levelIndex, progress, state.comfort, state.elapsed)
	local stars, coins
	if res then
		profile = res.profile
		stars, coins = res.stars, res.coins
	else
		stars = HoofSim.grade(level, progress, state.comfort, state.elapsed)
		coins = 0
		summary ..= "\n(couldn't reach the server — no reward saved)"
	end
	updateCoins()
	if stars > 0 then sfx(SFX.ding, 0.6) end
	showResult(stars > 0, summary, stars, coins)
end

startLevel = function(index)
	level = Config.Levels[index]
	if not level or index > profile.unlocked then return end
	levelIndex = index
	state = HoofSim.newState(level, profile.upgrades)
	view:load(state)
	buildToolButtons()
	selectTool(level.tools[1])
	titleLabel.Text = ("Level %d · %s\n%s"):format(index, level.name, level.horse)
	banner.Text = ""
	menu.Visible, shop.Visible, result.Visible = false, false, false
	view:show(true)
	hud.Visible = true
	playing, holding = true, false
	lastProgressCheck = 0
end

-- Menu --------------------------------------------------------------------
local function rebuildShop()
	for _, ch in ipairs(shopList:GetChildren()) do
		if ch:IsA("Frame") then ch:Destroy() end
	end
	for _, u in ipairs(Config.Upgrades) do
		local lvl = profile.upgrades[u.id] or 0
		local row = Ui.new("Frame", { Size = UDim2.new(1, 0, 0, 56), BackgroundColor3 = C.panelLight, BorderSizePixel = 0, ZIndex = 52 }, shopList)
		Ui.corner(row, 10)
		Ui.label(row, ("%s  (Lv %d/%d)"):format(u.name, lvl, Config.MAX_UPGRADE_LEVEL), 17, { Position = UDim2.fromOffset(12, 4), Size = UDim2.new(0.6, 0, 0, 24), TextXAlignment = Enum.TextXAlignment.Left, ZIndex = 53 })
		Ui.label(row, u.desc, 14, { Position = UDim2.fromOffset(12, 28), Size = UDim2.new(0.6, 0, 0, 22), TextXAlignment = Enum.TextXAlignment.Left, TextColor3 = C.dim, Font = Enum.Font.Gotham, ZIndex = 53 })
		local maxed = lvl >= Config.MAX_UPGRADE_LEVEL
		local cost = not maxed and Config.upgradeCost(u.id, lvl) or 0
		Ui.button(row, maxed and "MAX" or ("🪙 " .. cost), 16, {
			Position = UDim2.new(1, -118, 0.5, -20), Size = UDim2.fromOffset(106, 40), ZIndex = 53,
			BackgroundColor3 = (not maxed and profile.coins >= cost) and C.accent or C.panel,
		}, function()
			if maxed then return end
			local newProfile = remotes.BuyUpgrade:InvokeServer(u.id)
			if newProfile then
				profile = newProfile
				sfx(SFX.ding, 0.5)
				updateCoins()
				rebuildShop()
			end
		end)
	end
end

local function rebuildMenu()
	for _, ch in ipairs(grid:GetChildren()) do
		if ch:IsA("TextButton") then ch:Destroy() end
	end
	for i, lv in ipairs(Config.Levels) do
		local unlocked = i <= profile.unlocked
		local stars = profile.stars[tostring(i)] or 0
		local card = Ui.button(grid, "", 16, {
			LayoutOrder = i, BackgroundColor3 = unlocked and C.panel or Color3.fromRGB(38, 32, 30),
			AutoButtonColor = unlocked,
		}, function() startLevel(i) end)
		Ui.label(card, unlocked and ("Level " .. i) or "🔒 Locked", 14, { Position = UDim2.fromOffset(10, 8), Size = UDim2.new(1, -20, 0, 18), TextColor3 = C.dim, TextXAlignment = Enum.TextXAlignment.Left })
		Ui.label(card, lv.name, 19, { Position = UDim2.fromOffset(10, 28), Size = UDim2.new(1, -20, 0, 50), TextXAlignment = Enum.TextXAlignment.Left, TextYAlignment = Enum.TextYAlignment.Top, TextColor3 = unlocked and C.text or C.dim })
		Ui.label(card, starString(stars), 24, { Position = UDim2.new(0, 10, 1, -34), Size = UDim2.new(1, -20, 0, 28), TextColor3 = C.gold, TextXAlignment = Enum.TextXAlignment.Left })
	end
	rebuildShop()
end

shopBtn = Ui.button(menu, "🛒 Shop", 22, { Position = UDim2.fromScale(0.5, 0.92), AnchorPoint = Vector2.new(0.5, 0.5), Size = UDim2.fromOffset(200, 52), BackgroundColor3 = C.panelLight }, function()
	shop.Visible = not shop.Visible
	if shop.Visible then rebuildShop() end
end)
Ui.button(shop, "Close", 18, { Position = UDim2.new(0.5, 0, 1, -16), AnchorPoint = Vector2.new(0.5, 1), Size = UDim2.fromOffset(140, 44), ZIndex = 52 }, function() shop.Visible = false end)

showMenu = function()
	playing, holding = false, false
	view:show(false)
	hud.Visible, result.Visible, shop.Visible = false, false, false
	menu.Visible = true
	updateCoins()
	rebuildMenu()
end

exitBtn.Activated:Connect(function() if playing then showMenu() end end)
finishBtn.Activated:Connect(function() finish(true) end)
patBtn.Activated:Connect(function()
	if playing and HoofSim.pat(state) then showBanner("Good horse! 💚", 1.2, C.accent) end
end)

-- Input -------------------------------------------------------------------
local function isPointer(input)
	return input.UserInputType == Enum.UserInputType.MouseButton1 or input.UserInputType == Enum.UserInputType.Touch
end

local function hit(pos)
	local now = os.clock()
	local stats = Config.toolStats(tool, profile.upgrades)
	if now - lastHit < stats.cooldown then return end
	lastHit = now

	local gx, gy = view:toGrid(Vector2.new(pos.X, pos.Y))
	local changed, delta, info = HoofSim.apply(state, tool, gx, gy, stats)
	if #changed > 0 then
		view:refresh(changed)
		view:burst(Vector2.new(pos.X, pos.Y), BURST_COLOR[tool])
		if tool == "Nippers" then
			sfx(SFX.snap, 0.5, 1 + math.random() * 0.2)
		else
			sfx(SFX.scrape, 0.25, 0.8 + math.random() * 0.5, 0.07)
		end
	end
	if delta < -0.05 then
		view:flashPain(math.min(0.4, 0.08 - delta * 0.05))
		sfx(SFX.ouch, 0.25, 1.2, 0.5)
	end
	if info.flinched then
		showBanner("Ouch! The horse kicked — wait for it to settle!", 1.4, C.bad)
	elseif info.blocked and #changed == 0 then
		showBanner("Clear the dirt first with the Hoof Pick!", 1.4)
	end
end

view.input.InputBegan:Connect(function(input)
	if not playing or not isPointer(input) then return end
	holding = true
	view:setCursor(input.Position, Config.toolStats(tool, profile.upgrades).radius)
	hit(input.Position)
end)

view.input.InputChanged:Connect(function(input)
	if not playing then return end
	local t = input.UserInputType
	if t ~= Enum.UserInputType.MouseMovement and t ~= Enum.UserInputType.Touch then return end
	local stats = Config.toolStats(tool, profile.upgrades)
	view:setCursor(input.Position, stats.radius)
	if holding and not stats.click then hit(input.Position) end
end)

view.input.MouseLeave:Connect(function() view:setCursor(nil) end)

UserInputService.InputEnded:Connect(function(input)
	if isPointer(input) then
		holding = false
		if input.UserInputType == Enum.UserInputType.Touch then view:setCursor(nil) end
	end
end)

local KEYS = { Enum.KeyCode.One, Enum.KeyCode.Two, Enum.KeyCode.Three, Enum.KeyCode.Four, Enum.KeyCode.Five }
UserInputService.InputBegan:Connect(function(input, processed)
	if processed or not playing then return end
	if input.KeyCode == Enum.KeyCode.E then
		if HoofSim.pat(state) then showBanner("Good horse! 💚", 1.2, C.accent) end
		return
	end
	for n, key in ipairs(KEYS) do
		if input.KeyCode == key and level.tools[n] then selectTool(level.tools[n]) end
	end
end)

-- Game loop ---------------------------------------------------------------
RunService.Heartbeat:Connect(function(dt)
	if not playing then return end

	local ev = HoofSim.update(state, dt)
	if ev == "warn" then
		showBanner("⚠ The horse is getting restless — pat it (E)!", 1.1)
	elseif ev == "active" then
		showBanner("Hold still! Lift your tool!", 0.9, C.bad)
	end
	view:setShake(state.flinch == "active" and 7 or (state.flinch == "warn" and 2 or 0))

	-- HUD
	local comfortFrac = state.comfort / Config.MAX_COMFORT
	setComfort(comfortFrac, comfortFrac > 0.5 and C.accent or (comfortFrac > 0.25 and C.warn or C.bad))
	comfortText.Text = math.floor(state.comfort) .. "%"
	timeLabel.Text = ("%d:%02d"):format(math.floor(state.elapsed / 60), math.floor(state.elapsed % 60))
	timeLabel.TextColor3 = state.elapsed <= level.par and C.text or C.warn
	patBtn.Text = state.patCooldown > 0 and ("🐴 Pat (%ds)"):format(math.ceil(state.patCooldown)) or "🐴 Pat horse (E)"
	patBtn.BackgroundColor3 = state.patCooldown > 0 and C.panel or C.panelLight

	state.progressTimer = (state.progressTimer or 0) - dt
	if state.progressTimer <= 0 then
		state.progressTimer = 0.1
		local p = HoofSim.progress(state)
		setProgress(p)
		progressText.Text = math.floor(p * 100) .. "%"
		finishBtn.Visible = p >= Config.FINISH_AT
		if HoofSim.isComplete(state) then
			finish(true)
			return
		end
	end

	if state.comfort <= 0 then finish(false) end
end)

showMenu()
