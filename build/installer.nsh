!macro customInstallMode
  !ifndef BUILD_UNINSTALLER
    StrCpy $isForceCurrentInstall "1"
  !endif
!macroend

!macro customRemoveFiles
  StrCpy $R9 "$INSTDIR.__wenyao_data_preserved__"

  ${If} ${FileExists} "$INSTDIR\data\*.*"
    ${If} ${FileExists} "$R9\*.*"
      MessageBox MB_ICONSTOP "安装目录和数据保留目录同时存在。为避免覆盖用户数据，卸载或升级已停止。$\r$\n$INSTDIR\data$\r$\n$R9"
      Abort
    ${EndIf}

    ClearErrors
    Rename "$INSTDIR\data" "$R9"
    ${If} ${Errors}
      MessageBox MB_ICONSTOP "无法临时保留问爻数据，卸载或升级已停止。请关闭问爻后重试。$\r$\n$INSTDIR\data"
      Abort
    ${EndIf}
  ${EndIf}

  SetOutPath "$TEMP"
  RMDir /r "$INSTDIR"

  ${If} ${FileExists} "$R9\*.*"
    CreateDirectory "$INSTDIR"
    ClearErrors
    Rename "$R9" "$INSTDIR\data"
    ${If} ${Errors}
      MessageBox MB_ICONSTOP "程序文件已移除，但问爻数据未能恢复到安装目录。请保留以下目录并联系支持：$\r$\n$R9"
      Abort
    ${EndIf}
  ${EndIf}
!macroend
