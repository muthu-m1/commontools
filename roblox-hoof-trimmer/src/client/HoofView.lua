-- Renders the hoof grid as UI frames, plus cursor ring and shaving particles.

local TweenService = game:GetService("TweenService")

local Shared = game:GetService("ReplicatedStorage"):WaitForChild("Shared")
local Config = require(Shared:WaitForChild("Config"))
local HoofSim = require(Shared:WaitForChild("HoofSim"))
local Ui = require(script.Parent.Ui)

local W, H = Config.GRID_W, Config.GRID_H

local HoofView = {}
HoofView.__index = HoofView

local function lerpColor(a, b, t)
	return a:Lerp(b, math.clamp(t, 0, 1))
end

local COL = {
	dirtLight = Color3.fromRGB(168, 136, 100),
	dirtDark = Color3.fromRGB(84, 64, 48),
	wallOvergrown = Color3.fromRGB(70, 60, 54),
	wallClean = Color3.fromRGB(196, 178, 150),
	frogFlaky = Color3.fromRGB(196, 170, 150),
	frogClean = Color3.fromRGB(236, 186, 128),
	soleChalk = Color3.fromRGB(205, 200, 194),
	soleClean = Color3.fromRGB(252, 248, 240),
	thrush = Color3.fromRGB(38, 32, 38),
	dressed = Color3.fromRGB(110, 150, 220),
	sore = Color3.fromRGB(214, 70, 64),
}

function HoofView.new(parent)
	local self = setmetatable({}, HoofView)

	self.root = Ui.new("Frame", {
		Size = UDim2.fromScale(1, 1), BackgroundColor3 = Color3.fromRGB(192, 164, 124),
		BorderSizePixel = 0, Visible = false,
	}, parent)

	-- Sandy ground gradient.
	Ui.new("UIGradient", {
		Rotation = 90,
		Color = ColorSequence.new(Color3.fromRGB(150, 124, 92), Color3.fromRGB(214, 188, 148)),
	}, self.root)

	self.area = Ui.new("Frame", {
		AnchorPoint = Vector2.new(0.5, 0.5), Position = UDim2.fromScale(0.5, 0.56),
		Size = UDim2.fromScale(0.5, 0.74), BackgroundTransparency = 1,
	}, self.root)
	Ui.new("UIAspectRatioConstraint", { AspectRatio = W / H }, self.area)

	-- Leg (top) and farrier stand (bottom) are just decoration around the hoof.
	local leg = Ui.new("Frame", {
		Position = UDim2.fromScale(0.16, -0.62), Size = UDim2.fromScale(0.68, 0.7),
		BackgroundColor3 = Color3.fromRGB(128, 76, 42), BorderSizePixel = 0, ZIndex = 1,
	}, self.area)
	Ui.corner(leg, 40)
	Ui.new("UIGradient", {
		Color = ColorSequence.new(Color3.fromRGB(92, 52, 30), Color3.fromRGB(150, 92, 52)),
		Rotation = 90,
	}, leg)
	local stand = Ui.new("Frame", {
		Position = UDim2.fromScale(0.34, 0.96), Size = UDim2.fromScale(0.32, 0.5),
		BackgroundColor3 = Color3.fromRGB(110, 118, 122), BorderSizePixel = 0, ZIndex = 1,
	}, self.area)
	Ui.new("UIGradient", { Color = ColorSequence.new(Color3.fromRGB(70, 78, 82), Color3.fromRGB(150, 158, 160)) }, stand)

	self.cellHolder = Ui.new("Frame", {
		Size = UDim2.fromScale(1, 1), BackgroundTransparency = 1, ZIndex = 2,
	}, self.area)

	-- Invisible input catcher over the whole screen so strokes can start anywhere.
	self.input = Ui.new("TextButton", {
		Size = UDim2.fromScale(1, 1), BackgroundTransparency = 1, Text = "", ZIndex = 20,
		AutoButtonColor = false, Active = true,
	}, self.root)

	self.cursor = Ui.new("Frame", {
		AnchorPoint = Vector2.new(0.5, 0.5), BackgroundTransparency = 1,
		Size = UDim2.fromOffset(40, 40), Visible = false, ZIndex = 25,
	}, self.root)
	Ui.new("UIStroke", { Color = Color3.new(1, 1, 1), Thickness = 2, Transparency = 0.2 }, self.cursor)
	Ui.corner(self.cursor, 999)

	self.pain = Ui.new("Frame", {
		Size = UDim2.fromScale(1, 1), BackgroundColor3 = COL.sore, BackgroundTransparency = 1,
		BorderSizePixel = 0, ZIndex = 18, Active = false,
	}, self.root)

	self.frames = {}
	self.particleCount = 0
	return self
end

function HoofView:cellColor(c)
	local level = self.level
	local maxDirt = math.max(1, level.dirt)
	local col
	if c.dirt > 0 then
		return lerpColor(COL.dirtLight, COL.dirtDark, c.dirt / maxDirt)
	end
	if c.kind == "wall" then
		col = c.excess > 0 and COL.wallOvergrown or COL.wallClean
	elseif c.kind == "frog" then
		col = c.excess > 0 and COL.frogFlaky or COL.frogClean
		if c.thrush then col = COL.thrush
		elseif c.needsDress then col = lerpColor(COL.frogClean, COL.sore, 0.35)
		end
	else
		col = c.excess > 0 and COL.soleChalk or COL.soleClean
		if c.thrush then col = COL.thrush
		elseif c.needsDress then col = lerpColor(COL.soleClean, COL.sore, 0.35) end
	end
	if c.treated then col = lerpColor(col, COL.dressed, 0.6) end
	if c.rough > 0 then col = col:Lerp(Color3.fromRGB(90, 80, 70), 0.22 * c.rough) end
	if c.sore > 0 then col = col:Lerp(COL.sore, 0.7 * c.sore) end
	return col
end

function HoofView:load(state)
	self.state = state
	self.level = state.level
	for _, f in pairs(self.frames) do f:Destroy() end
	self.frames = {}
	for _, i in ipairs(state.inside) do
		local c = state.cells[i]
		self.frames[i] = Ui.new("Frame", {
			Position = UDim2.fromScale(c.x / W, c.y / H),
			Size = UDim2.new(1 / W, 1, 1 / H, 1),
			BackgroundColor3 = self:cellColor(c),
			BorderSizePixel = 0,
		}, self.cellHolder)
	end
end

function HoofView:refresh(indices)
	for _, i in ipairs(indices) do
		local f, c = self.frames[i], self.state.cells[i]
		if f and c then
			f.BackgroundColor3 = self:cellColor(c)
		end
	end
end

-- Convert a GUI position into float grid coordinates.
function HoofView:toGrid(pos)
	local ap, as = self.area.AbsolutePosition, self.area.AbsoluteSize
	return (pos.X - ap.X) / as.X * W - 0.5, (pos.Y - ap.Y) / as.Y * H - 0.5
end

function HoofView:cellPixels()
	return self.area.AbsoluteSize.X / W
end

function HoofView:setCursor(pos, radiusCells)
	if not pos then
		self.cursor.Visible = false
		return
	end
	local rel = Vector2.new(pos.X, pos.Y) - self.root.AbsolutePosition
	local d = radiusCells * 2 * self:cellPixels()
	self.cursor.Size = UDim2.fromOffset(d, d)
	self.cursor.Position = UDim2.fromOffset(rel.X, rel.Y)
	self.cursor.Visible = true
end

function HoofView:burst(pos, color)
	if self.particleCount > 60 then return end
	local rel = pos - self.root.AbsolutePosition
	for _ = 1, 3 do
		self.particleCount += 1
		local size = math.random(4, 9)
		local p = Ui.new("Frame", {
			Position = UDim2.fromOffset(rel.X, rel.Y), Size = UDim2.fromOffset(size, size),
			BackgroundColor3 = color, BorderSizePixel = 0, Rotation = math.random(0, 90), ZIndex = 22,
		}, self.root)
		local ang = math.random() * math.pi * 2
		local dist = math.random(20, 55)
		local tween = TweenService:Create(p, TweenInfo.new(0.45, Enum.EasingStyle.Quad, Enum.EasingDirection.Out), {
			Position = UDim2.fromOffset(rel.X + math.cos(ang) * dist, rel.Y + math.sin(ang) * dist + 25),
			BackgroundTransparency = 1, Rotation = math.random(-200, 200),
		})
		tween.Completed:Connect(function()
			p:Destroy()
			self.particleCount -= 1
		end)
		tween:Play()
	end
end

function HoofView:flashPain(strength)
	self.pain.BackgroundTransparency = 1 - math.clamp(strength or 0.3, 0, 0.6)
	TweenService:Create(self.pain, TweenInfo.new(0.35), { BackgroundTransparency = 1 }):Play()
end

-- Shake the hoof area (used when the horse shifts).
function HoofView:setShake(amount)
	if amount <= 0 then
		self.area.Position = UDim2.fromScale(0.5, 0.56)
	else
		self.area.Position = UDim2.new(0.5, math.random(-amount, amount), 0.56, math.random(-amount, amount))
	end
end

function HoofView:show(visible)
	self.root.Visible = visible
	if not visible then self.cursor.Visible = false end
end

return HoofView
