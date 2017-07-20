package readFile

import (
    "bufio"
    "fmt"
    "os"
    "strings"
    // "./error_log"
)

func ReadFile(path string, f os.FileInfo, err error) (error){
  todoList := []string{};
  var isDir bool
  file, err := os.Open(path)
  fi, error_stat:= file.Stat()
  if(err != nil ){
    return err
  }
  if(error_stat != nil ){
    return err
  }
  isDir = fi.IsDir()
  defer file.Close()
  if(isDir == false){
    // errorLog.PrintErrorLog(err)
    scanner := bufio.NewScanner(file)
    for scanner.Scan() {
      text := scanner.Text()
      if(strings.Contains(text,"TODO")){
        todoList = append(todoList,text)
      }
    }
    if(scanner.Err() != nil){
      return scanner.Err()
    }
    fmt.Println(todoList);
  }
  return nil
}
