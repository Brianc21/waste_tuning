# -*- mode: python ; coding: utf-8 -*-
# LEGACY — no longer used. Kept for reference only.
# As of v1.7, the build uses a bundled Python embeddable package (build_all.bat)
# instead of PyInstaller. This file is not referenced by any current build step.
# PyInstaller spec file for SQL Proxy Service

import os

block_cipher = None

# Get the backend path
backend_path = os.path.abspath(os.path.join(SPECPATH, '..', 'backend'))

a = Analysis(
    [os.path.join(backend_path, 'sql_proxy.py')],
    pathex=[backend_path],
    binaries=[],
    datas=[],
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
        'pyodbc',
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
    name='sql_proxy',
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
