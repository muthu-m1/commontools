-- Small helpers for building the game's UI from code.

local Ui = {}

Ui.Color = {
	bg = Color3.fromRGB(34, 28, 26),
	panel = Color3.fromRGB(52, 43, 38),
	panelLight = Color3.fromRGB(78, 64, 55),
	text = Color3.fromRGB(250, 243, 232),
	dim = Color3.fromRGB(196, 180, 160),
	accent = Color3.fromRGB(106, 190, 120),
	warn = Color3.fromRGB(240, 170, 70),
	bad = Color3.fromRGB(220, 80, 70),
	gold = Color3.fromRGB(255, 205, 80),
	sand = Color3.fromRGB(196, 168, 128),
}

function Ui.new(className, props, parent)
	local inst = Instance.new(className)
	for k, v in pairs(props or {}) do
		inst[k] = v
	end
	inst.Parent = parent
	return inst
end

function Ui.corner(parent, radius)
	return Ui.new("UICorner", { CornerRadius = UDim.new(0, radius or 8) }, parent)
end

function Ui.label(parent, text, size, props)
	local p = {
		BackgroundTransparency = 1,
		Text = text,
		TextColor3 = Ui.Color.text,
		TextSize = size or 18,
		Font = Enum.Font.GothamBold,
		TextWrapped = true,
	}
	for k, v in pairs(props or {}) do p[k] = v end
	return Ui.new("TextLabel", p, parent)
end

function Ui.button(parent, text, size, props, onClick)
	local p = {
		BackgroundColor3 = Ui.Color.panelLight,
		Text = text,
		TextColor3 = Ui.Color.text,
		TextSize = size or 18,
		Font = Enum.Font.GothamBold,
		AutoButtonColor = true,
		BorderSizePixel = 0,
	}
	for k, v in pairs(props or {}) do p[k] = v end
	local b = Ui.new("TextButton", p, parent)
	Ui.corner(b, 10)
	if onClick then b.Activated:Connect(onClick) end
	return b
end

function Ui.panel(parent, props)
	local p = { BackgroundColor3 = Ui.Color.panel, BorderSizePixel = 0 }
	for k, v in pairs(props or {}) do p[k] = v end
	local f = Ui.new("Frame", p, parent)
	Ui.corner(f, 14)
	return f
end

-- A horizontal bar. Returns the frame and a setter(fraction, color?).
function Ui.bar(parent, props, fillColor)
	local p = { BackgroundColor3 = Color3.fromRGB(24, 20, 18), BorderSizePixel = 0 }
	for k, v in pairs(props or {}) do p[k] = v end
	local frame = Ui.new("Frame", p, parent)
	Ui.corner(frame, 8)
	local fill = Ui.new("Frame", {
		Size = UDim2.fromScale(0, 1), BackgroundColor3 = fillColor, BorderSizePixel = 0,
	}, frame)
	Ui.corner(fill, 8)
	return frame, function(fraction, color)
		fill.Size = UDim2.fromScale(math.clamp(fraction, 0, 1), 1)
		if color then fill.BackgroundColor3 = color end
	end
end

return Ui
