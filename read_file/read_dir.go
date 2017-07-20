package readFile

import (
  "os"
  "path/filepath"
  "./../error_log"
)

func ReadAllFiles() {
  dir, err := os.Getwd()
  errorLog.PrintErrorLog(err)
  error := filepath.Walk(dir, ReadFile)
  errorLog.PrintErrorLog(error)
}
