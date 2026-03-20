# -*- mode: python ; coding: utf-8 -*-
# PyInstaller spec file for Dashboard API + Frontend

import os
import sys

block_cipher = None

# Get the backend path
backend_path = os.path.abspath(os.path.join(SPECPATH, '..', 'backend'))

a = Analysis(
    [os.path.join(backend_path, 'main.py')],
    pathex=[backend_path],
    binaries=[],
    datas=[
        (os.path.join(backend_path, 'static'), 'static'),          # Include built React app
        (os.path.join(backend_path, 'queries.json'), '.'),          # Include default queries (for Reset functionality)
    ],
    hiddenimports=[
        'uvicorn.logging',
        'uvicorn.loops',
        'uvicorn.loops.auto',
        'uvicorn.protocols',
        'uvicorn.protocols.http',
        'uvicorn.protocols.http.auto',
        'uvicorn.protocols.websockets',
        'uvicorn.protocols.websockets.auto',
        'uvicorn.lifespan',
        'uvicorn.lifespan.on',
        'db_proxy',
        'requests',
    ],
    hookspath=[],
    hooksconfig={},
    runtime_hooks=[],
    excludes=[],
    win_no_prefer_redirects=False,
    win_private_assemblies=False,
    cipher=block_cipher,
    noarchive=False,
)

pyz = PYZ(a.pure, a.zipped_data, cipher=block_cipher)

exe = EXE(
    pyz,
    a.scripts,
    a.binaries,
    a.zipfiles,
    a.datas,
    [],
    name='dashboard',
    debug=False,
    bootloader_ignore_signals=False,
    strip=False,
    upx=True,
    upx_exclude=[],
    runtime_tmpdir=None,
    console=True,
    disable_windowed_traceback=False,
    argv_emulation=False,
    target_arch=None,
    codesign_identity=None,
    entitlements_file=None,
    icon=None,
)
