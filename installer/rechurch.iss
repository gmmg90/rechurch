; ─── ReChurch — Inno Setup script ─────────────────────────────────────────
;
; Genera un installer Windows .exe.
;
; Compilare con:
;     "C:\Program Files (x86)\Inno Setup 6\ISCC.exe" installer\rechurch.iss
;   (oppure aprire il file con Inno Setup e premere F9)
;
; Prerequisito: aver eseguito build.ps1 (genera backend/dist/ReChurch/)

#define MyAppName "ReChurch"
#define MyAppVersion "1.0.0"
#define MyAppPublisher "Parrocchia Regina Pacis"
#define MyAppExeName "ReChurch.exe"
#define MyAppId "{{D8B7E5C0-1234-4567-89AB-CDEF12345678}"

[Setup]
AppId={#MyAppId}
AppName={#MyAppName}
AppVersion={#MyAppVersion}
AppVerName={#MyAppName} {#MyAppVersion}
AppPublisher={#MyAppPublisher}
DefaultDirName={autopf}\{#MyAppName}
DefaultGroupName={#MyAppName}
DisableProgramGroupPage=yes
DisableDirPage=auto
PrivilegesRequired=admin
PrivilegesRequiredOverridesAllowed=dialog
OutputDir=Output
OutputBaseFilename=ReChurch-Setup-{#MyAppVersion}
SetupIconFile=..\backend\icon.ico
Compression=lzma2/ultra
SolidCompression=yes
WizardStyle=modern
ArchitecturesAllowed=x64compatible
ArchitecturesInstallIn64BitMode=x64compatible
UninstallDisplayIcon={app}\{#MyAppExeName}
UninstallDisplayName={#MyAppName}

[Languages]
Name: "italian"; MessagesFile: "compiler:Languages\Italian.isl"

[Tasks]
Name: "desktopicon"; Description: "Crea un'icona sul Desktop"; GroupDescription: "Icone aggiuntive:"

[Files]
; Tutta la cartella ReChurch prodotta da PyInstaller
Source: "..\backend\dist\ReChurch\*"; DestDir: "{app}"; Flags: ignoreversion recursesubdirs createallsubdirs

[Dirs]
; Cartella dati persistente — accessibile a tutti gli utenti
Name: "C:\ReChurch"; Permissions: users-modify

[Icons]
Name: "{group}\{#MyAppName}"; Filename: "{app}\{#MyAppExeName}"; IconFilename: "{app}\{#MyAppExeName}"
Name: "{group}\Disinstalla {#MyAppName}"; Filename: "{uninstallexe}"
Name: "{autodesktop}\{#MyAppName}"; Filename: "{app}\{#MyAppExeName}"; IconFilename: "{app}\{#MyAppExeName}"; Tasks: desktopicon

[Run]
Filename: "{app}\{#MyAppExeName}"; Description: "Avvia {#MyAppName}"; Flags: nowait postinstall skipifsilent

[UninstallDelete]
; Lascia C:\ReChurch in modo da non perdere i dati al disinstall.
; Per cancellare anche i dati, scommentare:
; Type: filesandordirs; Name: "C:\ReChurch"
Type: files; Name: "{app}\*.log"

[Code]
function InitializeSetup(): Boolean;
begin
  Result := True;
end;

procedure CurStepChanged(CurStep: TSetupStep);
begin
  if CurStep = ssPostInstall then
  begin
    // Eventuali operazioni post-install
  end;
end;
