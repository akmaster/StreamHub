/**
 * NSIS Installer Build Script
 * Creates a Windows installer using NSIS
 */

import { execSync } from 'child_process';
import { existsSync, writeFileSync, readFileSync } from 'fs';
import { join } from 'path';

console.log('Building Windows installer with NSIS...');

try {
  // Check if NSIS is installed
  try {
    execSync('makensis /VERSION', { stdio: 'ignore' });
  } catch (error) {
    console.error('❌ NSIS not found. Please install NSIS first:');
    console.error('   Download from: https://nsis.sourceforge.io/Download');
    process.exit(1);
  }

  // Create NSIS script
  const nsisScript = `
; OBS Multi-Platform Streaming Installer
!include "MUI2.nsh"

; Installer Information
Name "OBS Multi-Platform Streaming"
OutFile "build\\obs-multi-platform-streaming-installer.exe"
InstallDir "$PROGRAMFILES\\OBSMultiPlatformStreaming"
RequestExecutionLevel admin

; Interface Settings
!define MUI_ABORTWARNING

; Pages
!insertmacro MUI_PAGE_WELCOME
!insertmacro MUI_PAGE_DIRECTORY
!insertmacro MUI_PAGE_INSTFILES
!insertmacro MUI_PAGE_FINISH

!insertmacro MUI_UNPAGE_WELCOME
!insertmacro MUI_UNPAGE_CONFIRM
!insertmacro MUI_UNPAGE_INSTFILES
!insertmacro MUI_UNPAGE_FINISH

; Languages
!insertmacro MUI_LANGUAGE "English"

; Installer Sections
Section "Install" SecInstall
    SetOutPath "$INSTDIR"
    
    ; Copy executable
    File "build\\obs-multi-platform-streaming.exe"
    
    ; Copy config file
    File "config.yaml"
    
    ; Create Start Menu shortcut
    CreateDirectory "$SMPROGRAMS\\OBS Multi-Platform Streaming"
    CreateShortcut "$SMPROGRAMS\\OBS Multi-Platform Streaming\\OBS Multi-Platform Streaming.lnk" "$INSTDIR\\obs-multi-platform-streaming.exe"
    CreateShortcut "$SMPROGRAMS\\OBS Multi-Platform Streaming\\Uninstall.lnk" "$INSTDIR\\Uninstall.exe"
    
    ; Create Desktop shortcut
    CreateShortcut "$DESKTOP\\OBS Multi-Platform Streaming.lnk" "$INSTDIR\\obs-multi-platform-streaming.exe"
    
    ; Write registry keys
    WriteRegStr HKLM "Software\\Microsoft\\Windows\\CurrentVersion\\Uninstall\\OBSMultiPlatformStreaming" "DisplayName" "OBS Multi-Platform Streaming"
    WriteRegStr HKLM "Software\\Microsoft\\Windows\\CurrentVersion\\Uninstall\\OBSMultiPlatformStreaming" "UninstallString" "$INSTDIR\\Uninstall.exe"
    WriteRegStr HKLM "Software\\Microsoft\\Windows\\CurrentVersion\\Uninstall\\OBSMultiPlatformStreaming" "InstallLocation" "$INSTDIR"
    WriteRegDWORD HKLM "Software\\Microsoft\\Windows\\CurrentVersion\\Uninstall\\OBSMultiPlatformStreaming" "NoModify" 1
    WriteRegDWORD HKLM "Software\\Microsoft\\Windows\\CurrentVersion\\Uninstall\\OBSMultiPlatformStreaming" "NoRepair" 1
    
    ; Create uninstaller
    WriteUninstaller "$INSTDIR\\Uninstall.exe"
SectionEnd

; Uninstaller Section
Section "Uninstall"
    ; Remove files
    Delete "$INSTDIR\\obs-multi-platform-streaming.exe"
    Delete "$INSTDIR\\config.yaml"
    Delete "$INSTDIR\\Uninstall.exe"
    
    ; Remove shortcuts
    Delete "$SMPROGRAMS\\OBS Multi-Platform Streaming\\OBS Multi-Platform Streaming.lnk"
    Delete "$SMPROGRAMS\\OBS Multi-Platform Streaming\\Uninstall.lnk"
    RMDir "$SMPROGRAMS\\OBS Multi-Platform Streaming"
    Delete "$DESKTOP\\OBS Multi-Platform Streaming.lnk"
    
    ; Remove registry keys
    DeleteRegKey HKLM "Software\\Microsoft\\Windows\\CurrentVersion\\Uninstall\\OBSMultiPlatformStreaming"
    
    ; Remove directory
    RMDir "$INSTDIR"
SectionEnd
`;

  const nsisScriptPath = join(process.cwd(), 'scripts', 'installer.nsi');
  writeFileSync(nsisScriptPath, nsisScript);

  // Build installer
  console.log('Building installer...');
  execSync(`makensis "${nsisScriptPath}"`, {
    stdio: 'inherit',
    cwd: process.cwd()
  });

  console.log('✅ Installer built successfully!');
  console.log(`Output: ${join(process.cwd(), 'build', 'obs-multi-platform-streaming-installer.exe')}`);
} catch (error) {
  console.error('❌ Build failed:', error.message);
  process.exit(1);
}

