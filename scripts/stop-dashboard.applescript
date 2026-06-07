on run
  set appBundle to POSIX path of (path to me)
  set projectDir to do shell script "/usr/bin/dirname " & quoted form of appBundle
  set stopScript to quoted form of (projectDir & "/scripts/stop-background.sh")

  try
    do shell script "export PATH='/usr/bin:/bin:/usr/sbin:/sbin'; /bin/bash " & stopScript
    display notification "Kiddo dashboard stopped" with title "Kiddo Analytics"
  on error errMsg
    display alert "Could not stop dashboard" message errMsg buttons {"OK"} default button 1
  end try
end run
