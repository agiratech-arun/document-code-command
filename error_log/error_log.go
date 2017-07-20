package errorLog

import "log"

func PrintErrorLog (err error){
  if err != nil {
    log.Fatal(err)
  }
}
