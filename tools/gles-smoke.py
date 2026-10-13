#!/usr/bin/env python3
"""Actual native GLES compile/link/upload/draw/readback on a software pbuffer.
Requires existing EGL/Mesa and Pillow (development only). This is not Chromium,
WebGL security validation, physical GPU, CSS layout or gameplay-feel testing.
"""
from pathlib import Path
import ctypes as c
import ctypes.util
import json
import os
import sys
from PIL import Image, ImageStat

os.environ.setdefault('EGL_PLATFORM', 'surfaceless')
os.environ.setdefault('LIBGL_ALWAYS_SOFTWARE', '1')
root = Path(__file__).resolve().parents[1]
evidence = Path(os.environ.get('CHASE_QA_EVIDENCE', str(root.parent/'final-evidence')))/'gles'
stream = json.loads((evidence/'commands.json').read_text(encoding='utf-8'))
width, height = stream['width'], stream['height']
E = c.CDLL(ctypes.util.find_library('EGL'))

def egl(name, result, *args):
    fn = getattr(E, name)
    fn.argtypes, fn.restype = list(args), result
    return fn

get_error = egl('eglGetError', c.c_uint)
get_display = egl('eglGetDisplay', c.c_void_p, c.c_void_p)
initialize = egl('eglInitialize', c.c_uint, c.c_void_p, c.POINTER(c.c_int), c.POINTER(c.c_int))
bind_api = egl('eglBindAPI', c.c_uint, c.c_uint)
choose_config = egl('eglChooseConfig', c.c_uint, c.c_void_p, c.POINTER(c.c_int), c.POINTER(c.c_void_p), c.c_int, c.POINTER(c.c_int))
create_context = egl('eglCreateContext', c.c_void_p, c.c_void_p, c.c_void_p, c.c_void_p, c.POINTER(c.c_int))
create_surface = egl('eglCreatePbufferSurface', c.c_void_p, c.c_void_p, c.c_void_p, c.POINTER(c.c_int))
make_current = egl('eglMakeCurrent', c.c_uint, c.c_void_p, c.c_void_p, c.c_void_p, c.c_void_p)
get_proc = egl('eglGetProcAddress', c.c_void_p, c.c_char_p)
terminate = egl('eglTerminate', c.c_uint, c.c_void_p)
display = get_display(None)
major, minor = c.c_int(), c.c_int()
assert initialize(display, c.byref(major), c.byref(minor)), ('eglInitialize', hex(get_error()))
assert bind_api(0x30A0)
attributes = (c.c_int*15)(0x3033, 1, 0x3040, 4, 0x3024, 8, 0x3023, 8, 0x3022, 8, 0x3025, 24, 0x3021, 8, 0x3038)
config, count = c.c_void_p(), c.c_int()
assert choose_config(display, attributes, c.byref(config), 1, c.byref(count)) and count.value
context = create_context(display, config, None, (c.c_int*3)(0x3098, 2, 0x3038))
assert context, ('eglCreateContext', hex(get_error()))
surface = create_surface(display, config, (c.c_int*5)(0x3057, width, 0x3056, height, 0x3038))
assert surface, ('eglCreatePbufferSurface', hex(get_error()))
assert make_current(display, surface, surface, context), ('eglMakeCurrent', hex(get_error()))
functions = {}

def gl(name, result, *args):
    if name not in functions:
        address = get_proc(('gl'+name[0].upper()+name[1:]).encode())
        assert address, name
        functions[name] = c.CFUNCTYPE(result, *args)(address)
    return functions[name]

get_string = gl('getString', c.c_char_p, c.c_uint)
gl_error = gl('getError', c.c_uint)
refs, frames = {}, []
shader_types = {}

def ref(value):
    return refs[value['ref']] if isinstance(value, dict) and 'ref' in value else value

def float_values(value):
    if isinstance(value, dict) and 'binary' in value:
        data = (evidence/value['binary']).read_bytes()
        return (c.c_float*(len(data)//4)).from_buffer_copy(data)
    return (c.c_float*len(value))(*value)

def compile_status(shader):
    ok = c.c_int()
    gl('getShaderiv', None, c.c_uint, c.c_uint, c.POINTER(c.c_int))(shader, 0x8B81, c.byref(ok))
    if not ok.value:
        info = c.create_string_buffer(8192)
        gl('getShaderInfoLog', None, c.c_uint, c.c_int, c.POINTER(c.c_int), c.c_char_p)(shader, len(info), None, info)
        raise AssertionError('Native GLES shader compile failed: '+info.value.decode())

def link_status(program):
    ok = c.c_int()
    gl('getProgramiv', None, c.c_uint, c.c_uint, c.POINTER(c.c_int))(program, 0x8B82, c.byref(ok))
    if not ok.value:
        info = c.create_string_buffer(8192)
        gl('getProgramInfoLog', None, c.c_uint, c.c_int, c.POINTER(c.c_int), c.c_char_p)(program, len(info), None, info)
        raise AssertionError('Native GLES program link failed: '+info.value.decode())

def replay(command):
    name, args = command['fn'], command['args']
    result = command.get('result')
    if name in ['createShader', 'createProgram']:
        refs[result['ref']] = gl(name, c.c_uint, *([c.c_uint] if name == 'createShader' else []))(*args)
    elif name == 'createBuffer':
        value = c.c_uint()
        gl('genBuffers', None, c.c_int, c.POINTER(c.c_uint))(1, c.byref(value))
        refs[result['ref']] = value.value
    elif name == 'shaderSource':
        shader, source = ref(args[0]), args[1].encode()
        ptr, length = c.c_char_p(source), c.c_int(len(source))
        gl(name, None, c.c_uint, c.c_int, c.POINTER(c.c_char_p), c.POINTER(c.c_int))(shader, 1, c.byref(ptr), c.byref(length))
    elif name == 'compileShader':
        gl(name, None, c.c_uint)(ref(args[0]))
        compile_status(ref(args[0]))
    elif name == 'attachShader':
        gl(name, None, c.c_uint, c.c_uint)(*map(ref, args))
    elif name == 'linkProgram':
        gl(name, None, c.c_uint)(ref(args[0]))
        link_status(ref(args[0]))
    elif name in ['getAttribLocation', 'getUniformLocation']:
        refs[result['ref']] = gl(name, c.c_int, c.c_uint, c.c_char_p)(ref(args[0]), args[1].encode())
    elif name in ['useProgram', 'enable', 'disable', 'depthFunc', 'clear']:
        gl(name, None, c.c_uint)(ref(args[0]))
    elif name == 'bindBuffer':
        gl(name, None, c.c_uint, c.c_uint)(args[0], ref(args[1]))
    elif name == 'bufferData':
        target, data, usage = args
        if isinstance(data, dict):
            array = float_values(data)
            gl(name, None, c.c_uint, c.c_ssize_t, c.c_void_p, c.c_uint)(target, c.sizeof(array), array, usage)
        else:
            gl(name, None, c.c_uint, c.c_ssize_t, c.c_void_p, c.c_uint)(target, data, None, usage)
    elif name == 'bufferSubData':
        array = float_values(args[2])
        gl(name, None, c.c_uint, c.c_ssize_t, c.c_ssize_t, c.c_void_p)(args[0], args[1], c.sizeof(array), array)
    elif name == 'enableVertexAttribArray':
        gl(name, None, c.c_uint)(ref(args[0]))
    elif name == 'vertexAttribPointer':
        gl(name, None, c.c_uint, c.c_int, c.c_uint, c.c_ubyte, c.c_int, c.c_void_p)(ref(args[0]), *args[1:5], c.c_void_p(args[5]))
    elif name in ['uniform1f', 'uniform2f', 'uniform3f']:
        gl(name, None, c.c_int, *([c.c_float]*(len(args)-1)))(ref(args[0]), *args[1:])
    elif name == 'uniform3fv':
        gl(name, None, c.c_int, c.c_int, c.POINTER(c.c_float))(ref(args[0]), 1, float_values(args[1]))
    elif name == 'uniformMatrix4fv':
        gl(name, None, c.c_int, c.c_int, c.c_ubyte, c.POINTER(c.c_float))(ref(args[0]), 1, args[1], float_values(args[2]))
    elif name == 'viewport':
        gl(name, None, c.c_int, c.c_int, c.c_int, c.c_int)(*args)
    elif name == 'clearColor':
        gl(name, None, c.c_float, c.c_float, c.c_float, c.c_float)(*args)
    elif name == 'depthMask':
        gl(name, None, c.c_ubyte)(args[0])
    elif name == 'blendFunc':
        gl(name, None, c.c_uint, c.c_uint)(*args)
    elif name == 'drawArrays':
        gl(name, None, c.c_uint, c.c_int, c.c_int)(args[0], args[1], int(args[2]))
    elif name == 'deleteBuffer':
        value = c.c_uint(ref(args[0]))
        gl('deleteBuffers', None, c.c_int, c.POINTER(c.c_uint))(1, c.byref(value))
    elif name in ['deleteShader', 'deleteProgram']:
        gl(name, None, c.c_uint)(ref(args[0]))
    elif name == '__frame':
        gl('finish', None)()
        pixels = (c.c_ubyte*(width*height*4))()
        gl('readPixels', None, c.c_int, c.c_int, c.c_int, c.c_int, c.c_uint, c.c_uint, c.c_void_p)(0, 0, width, height, 0x1908, 0x1401, pixels)
        image = Image.frombytes('RGBA', (width, height), pixels).transpose(Image.Transpose.FLIP_TOP_BOTTOM)
        image.save(evidence/(args[0]['name']+'.png'))
        deviation = ImageStat.Stat(image.convert('RGB')).stddev
        assert max(deviation) > 5, ('Blank native GLES scene', args[0], deviation)
        record = {**args[0], 'result': 'PASS', 'pixel_stddev': deviation}
        if args[0].get('expectedCarSide'):
            coordinates = []
            rgb_image = image.convert('RGB')
            for yy in range(int(height*.48), int(height*.84)):
                for xx in range(int(width*.18), int(width*.82)):
                    rr, gg, bb = rgb_image.getpixel((xx, yy))
                    if rr > 90 and gg < 65 and bb < 65:
                        coordinates.append(xx)
            assert len(coordinates) > 100, ('Red car mask not found', args[0])
            centroid = sum(coordinates)/len(coordinates)
            assert (centroid < width/2) == (args[0]['expectedCarSide'] == 'left'), ('Rendered steering direction inverted', args[0], centroid, width/2)
            record['car_centroid_x'] = centroid
        frames.append(record)
    else:
        raise AssertionError('Unhandled actual GL command: '+name)
    error = gl_error()
    assert error == 0, (name, hex(error))

try:
    for command in stream['commands']:
        replay(command)
    result = {'result': 'PASS', 'egl': f'{major.value}.{minor.value}', 'gles': get_string(0x1F02).decode(), 'renderer': get_string(0x1F01).decode(), 'vendor': get_string(0x1F00).decode(), 'frames': frames, 'geometry': stream['stats'], 'scope': 'Actual software GLES compile/link/upload/draw/readback from captured game renderer calls. Not a browser, WebGL platform, physical GPU or gameplay-feel test.'}
    (evidence/'results.json').write_text(json.dumps(result, indent=2), encoding='utf-8')
    print(json.dumps({'result': 'PASS', 'scenes': len(frames), 'renderer': result['renderer'], 'scope': result['scope']}))
finally:
    make_current(display, None, None, None)
    terminate(display)
