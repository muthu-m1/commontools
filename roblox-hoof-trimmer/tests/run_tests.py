"""Runs the pure-Lua simulation tests: pip install lupa; python3 tests/run_tests.py"""
import os
from lupa import LuaRuntime

root = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..")
lua = LuaRuntime(unpack_returned_tuples=True)
lua.execute("""
function load_module(path, config)
  local f = assert(io.open(path)); local src = f:read('a'); f:close()
  script = { Parent = { Config = config } }
  return assert(load(src, path))()
end
real_require = require
function require(m) if type(m) == 'table' then return m end return real_require(m) end
""")
load = lua.globals().load_module
config = load(os.path.join(root, "src/shared/Config.lua"), None)
sim = load(os.path.join(root, "src/shared/HoofSim.lua"), config)
lua.globals().Config, lua.globals().HoofSim = config, sim
with open(os.path.join(root, "tests/sim_test.lua")) as f:
    lua.execute(f.read())
