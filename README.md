# server_key_nodejs
Setup trong file config.js, sau đó chạy file run.js lên<br>
Rồi vào localhost:(port tự đặt) hoặc 127.0.0.1:(port tự đặt)<br>
Url check key: http://localhost:6969/check_key?key={key}<br>
Url tạo key, xóa key: Tự mò và thử:))<br>
Response của check key<br>
{
  "code": 1,
  "Message": "Key co ton tai trong he thong",
  "Info": {
    "id_key": 17,
    "key": "cangcu",
    "full_name": "trantronghoa",
    "create_date": "2022-09-28",
    "exp_date": "2022-09-20",
    "activity": false
  }
}
<br>
Lưu ý: Này lưu trên Mysql nhé<br>
