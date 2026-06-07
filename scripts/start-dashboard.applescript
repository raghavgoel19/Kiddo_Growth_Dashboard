on run
  set appBundle to POSIX path of (path to me)
  set projectDir to do shell script "/usr/bin/dirname " & quoted form of appBundle

  set shellPath to "/opt/anaconda3/bin:/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin:/usr/sbin:/sbin"
  set startScript to quoted form of (projectDir & "/scripts/start-background.sh")

  try
    do shell script "export PATH=" & quoted form of shellPath & "; /bin/bash " & startScript
  on error errMsg number errNum
    display alert "Dashboard failed to start" message errMsg buttons {"OK"} default button 1
    return
  end try

  set ready to false
  repeat with i from 1 to 60
    try
      do shell script "/usr/bin/curl -sf http://localhost:5173 >/dev/null"
      set ready to true
      exit repeat
    end try
    delay 1
  end repeat

  if ready then
    do shell script "/usr/bin/open http://localhost:5173/"
  else
    display alert "Dashboard failed to start" message "Check .run.log in the kiddo_dashboard folder. Ensure SHOPIFY_ACCESS_TOKEN is set in server/.env." buttons {"OK"} default button 1
  end if
end run
