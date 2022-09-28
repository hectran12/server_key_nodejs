const mysql = require('mysql');
const http = require('http');
const { createConnection } = require('net');
const config = require('./config.js');
const setup = config.get_config();
const url = require('url');
const { fstat } = require('fs');
const fs = require('fs');
const { resolve } = require('path');
const { on } = require('events');
const connectMysql = new Promise(function (resolve, reject) {
    var sql = mysql.createConnection({
        user: setup.userMysql,
        password: setup.passwordMysql,
    });
    sql.connect(function (err) {
        if(err) {
            reject(err);
        } else {
            resolve(sql);
        }
    })
});

const reconnectWithDatabase = new Promise(function (resolve, reject) {
    var sql = mysql.createConnection({
        user: setup.userMysql,
        password: setup.passwordMysql,
        database: setup.database
    });
    sql.connect(function (err) {
        if(err) {
            reject(err);
        } else {
            resolve(sql);
        }
    });
});
connectMysql.then(function (con) {
    getAllDatabase(con).then(function (data) {
        
        // check database if not exist preiod create and reconnect with database
        var statusExistDatabase = false;
        data.forEach(function (value, index) {
            if (value.Database == setup.database) statusExistDatabase = true;
        });

        if(!statusExistDatabase) {
            showLog('Đang tạo database cho bạn vui lòng đợi giây lát...!');
            createDatabase(con, setup.database).then(function (data) {
                showLog('Tạo database thành công!');
            }).catch(function (err) {
                showLog(err.sqlMessage);
                throw err;
            })
        } else {
            showLog('Database đã tồn tại, tiến hành kết nối tới database!');
        }
        reconnectWithDatabase.then(function (con) {
            showLog('Kết nối thành công tới database ' + setup.database);
            // check table if not exist preiod create
            getAllTables(con).then(function (data) {
                if (data == false) {
                    showLog('Chưa có một bảng nào được tạo, tiến hành tạo!');
                    createTable(con).then(function (data) {
                        showLog('Tạo thành công một bảng chứa key');
                    }).catch(function (err) {
                        showLog(err.sqlMessage);
                        throw err;
                    });
                } else {
                    showLog('Bạn đang sài database cũ, hãy chắc rằng mọi thứ điều ổn và trong tầm kiểm soát!');
                }

                startServer(con);

            }).catch(function (err) {
                showLog(err.sqlMessage);
                throw err;
            })
        }).catch (function (err) {
            showLog(err.sqlMessage);
            throw err;
        });

        


    }).catch(function (err) {
        showLog(err.sqlMessage);
        throw err;
    });
}).catch(function (err) {
    throw err;
});

function startServer (con) {
    http.createServer(function (req, res) {
        var query = url.parse(req.url, true);
        let StatusCreateKey = 'STATUS_CREATE_KEY_NO_CHANGE_PLS';
        let StatusPanelKey = 'STATUS_PANEL_KEY';
        let PanelKey = 'TRONGHOA_HEXZZ2008_PANEL_KEY____THANG_VIET_QUA_LUOI_DE_XU_LY_CASE_NAY_AHAHAHAHA';

        if(query.pathname == '/khoi_tao.html') {
            fs.readFile('./khoi_tao.html', 'utf-8', function (err, data) {
                if (err) {
                    res.writeHead(404, {
                        'Content-Type': 'text/html'
                    });
                    res.end('Can\'t load this page for you to view');
                    console.log(err);
                } else {
                    res.writeHead(200, {
                        'Content-Type': 'text/html'
                    });
                    data = data.replace(StatusCreateKey, 'Chưa có thông báo gì.')
                    .replace(StatusPanelKey, 'Chưa có thông báo gì');
                    showAllKey(con).then(function (dataKey) {
                        if (dataKey.length == 0) {
                            data = data.replace(PanelKey, 'Chưa có key nào được khởi tạo!');
                            res.end(data);
                        } else {
                            console.log(dataKey);
                            var contentTable = '<table>';
                            contentTable += `
                                <tr>
                                    <th>STT</th>
                                    <th>KEY</th>
                                    <th>Họ và tên</th>
                                    <th>Ngày tạo</th>
                                    <th>HSD</th>
                                    <th>Tình trạng</th>
                                    <th>Hành động</th>
                                </tr>
                            `;
                            dataKey.forEach(function (value, index) {
                                let id, key_name, fullname_key, ngaytao, hsd;
                                id = value.id;
                                key_name = value.key_name;
                                fullname_key = value.fullname_key;
                                ngaytao = value.ngaytao;
                                hsd = value.hsd;
                                var tachNgay = ngaytao.split('-');
                                var tachNgayEnd = hsd.split('-');
                                var dateCreate = new Date(parseInt(tachNgay[0]), parseInt(tachNgay[1])-1, parseInt(tachNgay[2])+1);
                                var dateEnd = new Date(parseInt(tachNgayEnd[0]), parseInt(tachNgayEnd[1])-1, parseInt(tachNgayEnd[2])+1);
                                var today = new Date();
                                contentTable += `
                                    <tr>
                                        <td>${index+1}</td>
                                        <td>${key_name}</td>
                                        <td>${fullname_key}</td>
                                        <td>${ngaytao}</td>
                                        <td>${hsd}</td>
                                        <td>${today > dateEnd ? '<h5 style="color:red">Hết hạn</h5>' : '<h5 style="color:green">Còn hạn</h5>'}</td>
                                        <td><button onclick="removeKey(${id})">Xóa key</button></td>
                                    </tr>
                                
                                `;
                            });
                            contentTable += '</table>';
                            data = data.replace(PanelKey, contentTable);
                            res.end(data);
                        }
                    }).catch(function (err) {
                        showLog(err.sqlMessage);
                        data = 'Cannot request';
                        res.end(data);
                    });
                }
            });
        } else if(query.pathname == '/create_key') {
            let fullname_key, key, exp;
            var qq = query.query;
            fullname_key = qq.fullname_key;
            key = qq.key;
            exp = qq.exp;
            if (fullname_key == undefined || key == undefined || exp == undefined || exp == '') {
                fs.readFile('./khoi_tao.html', 'utf-8', function (err, data) {
                    if(err) {
                        showLog('File chưa được khởi tạo hoặc chưa có [file: khoi_tao.html]');
                        res.end('Request cannot');
                    } else {
                        showLog('Tạo key không thành công do thiếu tham số đưa vào');
                        data = data.replace(StatusCreateKey, 'Tạo key không thành công do thiếu tham số đưa vào')
                        .replace(StatusPanelKey, 'Chưa có thông báo gì');
                        showAllKey(con).then(function (dataKey) {
                            if (dataKey.length == 0) {
                                data = data.replace(PanelKey, 'Chưa có key nào được khởi tạo!');
                                res.end(data);
                            } else {
                                console.log(dataKey);
                                var contentTable = '<table>';
                                contentTable += `
                                    <tr>
                                        <th>STT</th>
                                        <th>KEY</th>
                                        <th>Họ và tên</th>
                                        <th>Ngày tạo</th>
                                        <th>HSD</th>
                                        <th>Tình trạng</th>
                                        <th>Hành động</th>
                                    </tr>
                                `;
                                dataKey.forEach(function (value, index) {
                                    let id, key_name, fullname_key, ngaytao, hsd;
                                    id = value.id;
                                    key_name = value.key_name;
                                    fullname_key = value.fullname_key;
                                    ngaytao = value.ngaytao;
                                    hsd = value.hsd;
                                    var tachNgay = ngaytao.split('-');
                                    var tachNgayEnd = hsd.split('-');
                                    var dateCreate = new Date(parseInt(tachNgay[0]), parseInt(tachNgay[1])-1, parseInt(tachNgay[2])+1);
                                    var dateEnd = new Date(parseInt(tachNgayEnd[0]), parseInt(tachNgayEnd[1])-1, parseInt(tachNgayEnd[2])+1);
                                    var today = new Date();
                                    contentTable += `
                                        <tr>
                                            <td>${index+1}</td>
                                            <td>${key_name}</td>
                                            <td>${fullname_key}</td>
                                            <td>${ngaytao}</td>
                                            <td>${hsd}</td>
                                            <td>${today > dateEnd ? '<h5 style="color:red">Hết hạn</h5>' : '<h5 style="color:green">Còn hạn</h5>'}</td>
                                            <td><button onclick="removeKey(${id})">Xóa key</button></td>
                                        </tr>
                                    
                                    `;
                                });
                                contentTable += '</table>';
                                data = data.replace(PanelKey, contentTable);
                                res.end(data);
                            }
                        }).catch(function (err) {
                            showLog(err.sqlMessage);
                            data = 'Cannot request';
                            res.end(data);
                        });
                    }
                });
            } else {
                createKey(con, fullname_key, key, exp).then(function (data) {
                    showLog('Tạo key thành công!');
                    fs.readFile('./khoi_tao.html', 'utf-8', function (err, data) {
                        if(err) {
                            showLog('File chưa được khởi tạo hoặc chưa có [file: khoi_tao.html]');
                            res.end('Request cannot');
                        } else {
                            data = data.replace(StatusCreateKey, 'Đã tạo key thành công!')
                            .replace(StatusPanelKey, 'Chưa có thông báo gì');
                            showAllKey(con).then(function (dataKey) {
                                if (dataKey.length == 0) {
                                    data = data.replace(PanelKey, 'Chưa có key nào được khởi tạo!');
                                    res.end(data);
                                } else {
                                    console.log(dataKey);
                                    var contentTable = '<table>';
                                    contentTable += `
                                        <tr>
                                            <th>STT</th>
                                            <th>KEY</th>
                                            <th>Họ và tên</th>
                                            <th>Ngày tạo</th>
                                            <th>HSD</th>
                                            <th>Tình trạng</th>
                                            <th>Hành động</th>
                                        </tr>
                                    `;
                                    dataKey.forEach(function (value, index) {
                                        let id, key_name, fullname_key, ngaytao, hsd;
                                        id = value.id;
                                        key_name = value.key_name;
                                        fullname_key = value.fullname_key;
                                        ngaytao = value.ngaytao;
                                        hsd = value.hsd;
                                        var tachNgay = ngaytao.split('-');
                                        var tachNgayEnd = hsd.split('-');
                                        var dateCreate = new Date(parseInt(tachNgay[0]), parseInt(tachNgay[1])-1, parseInt(tachNgay[2])+1);
                                        var dateEnd = new Date(parseInt(tachNgayEnd[0]), parseInt(tachNgayEnd[1])-1, parseInt(tachNgayEnd[2])+1);
                                        var today = new Date();
                                        contentTable += `
                                            <tr>
                                                <td>${index+1}</td>
                                                <td>${key_name}</td>
                                                <td>${fullname_key}</td>
                                                <td>${ngaytao}</td>
                                                <td>${hsd}</td>
                                                <td>${today > dateEnd ? '<h5 style="color:red">Hết hạn</h5>' : '<h5 style="color:green">Còn hạn</h5>'}</td>
                                                <td><button onclick="removeKey(${id})">Xóa key</button></td>
                                            </tr>
                                        
                                        `;
                                    });
                                    contentTable += '</table>';
                                    data = data.replace(PanelKey, contentTable);
                                    res.end(data);
                                }
                            }).catch(function (err) {
                                showLog(err.sqlMessage);
                                data = 'Cannot request';
                                res.end(data);
                            });
                        }
                    });
                }).catch(function (errS) {
                  
                    fs.readFile('./khoi_tao.html', 'utf-8', function (err, data) {
                        if(err) {
                            showLog('File chưa được khởi tạo hoặc chưa có [file: khoi_tao.html]');
                            res.end('Request cannot');
                        } else {
                            if (errS.Message != undefined) showLog(errS.Message);
                            else showLog('Có lỗi trong quá trình tạo key');
                            data = data.replace(StatusCreateKey, errS.Message != undefined ? errS.Message: 'Tạo key không thành công do có lỗi, check ở console')
                            .replace(StatusPanelKey, 'Chưa có thông báo gì');
                            showAllKey(con).then(function (dataKey) {
                                if (dataKey.length == 0) {
                                    data = data.replace(PanelKey, 'Chưa có key nào được khởi tạo!');
                                    res.end(data);
                                } else {
                                    console.log(dataKey);
                                    var contentTable = '<table>';
                                    contentTable += `
                                        <tr>
                                            <th>STT</th>
                                            <th>KEY</th>
                                            <th>Họ và tên</th>
                                            <th>Ngày tạo</th>
                                            <th>HSD</th>
                                            <th>Tình trạng</th>
                                            <th>Hành động</th>
                                        </tr>
                                    `;
                                    dataKey.forEach(function (value, index) {
                                        let id, key_name, fullname_key, ngaytao, hsd;
                                        id = value.id;
                                        key_name = value.key_name;
                                        fullname_key = value.fullname_key;
                                        ngaytao = value.ngaytao;
                                        hsd = value.hsd;
                                        var tachNgay = ngaytao.split('-');
                                        var tachNgayEnd = hsd.split('-');
                                        var dateCreate = new Date(parseInt(tachNgay[0]), parseInt(tachNgay[1])-1, parseInt(tachNgay[2])+1);
                                        var dateEnd = new Date(parseInt(tachNgayEnd[0]), parseInt(tachNgayEnd[1])-1, parseInt(tachNgayEnd[2])+1);
                                        var today = new Date();
                                        contentTable += `
                                            <tr>
                                                <td>${index+1}</td>
                                                <td>${key_name}</td>
                                                <td>${fullname_key}</td>
                                                <td>${ngaytao}</td>
                                                <td>${hsd}</td>
                                                <td>${today > dateEnd ? '<h5 style="color:red">Hết hạn</h5>' : '<h5 style="color:green">Còn hạn</h5>'}</td>
                                                <td><button onclick="removeKey(${id})">Xóa key</button></td>
                                            </tr>
                                        
                                        `;
                                    });
                                    contentTable += '</table>';
                                    data = data.replace(PanelKey, contentTable);
                                    res.end(data);
                                }
                            }).catch(function (err) {
                                showLog(err.sqlMessage);
                                data = 'Cannot request';
                                res.end(data);
                            });
                        }
                    });
                });

            }
        } else if(query.pathname == '/remove_key') {
            var qq = query.query;
            if (qq.id == undefined) {
                fs.readFile('./khoi_tao.html', 'utf-8', function (err, data) {
                    if(err) {
                        showLog('File chưa được khởi tạo hoặc chưa có [file: khoi_tao.html]');
                        res.end('Request cannot');
                    } else {
                            showLog('Thiếu tham số đưa vào');
                            data = data.replace(StatusCreateKey, 'Chưa có thông báo gì')
                                        .replace(StatusPanelKey, 'Thiếu tham số đưa vào');
                            showAllKey(con).then(function (dataKey) {
                                if (dataKey.length == 0) {
                                    data = data.replace(PanelKey, 'Chưa có key nào được khởi tạo!');
                                    res.end(data);
                                } else {
                                    console.log(dataKey);
                                    var contentTable = '<table>';
                                    contentTable += `
                                        <tr>
                                            <th>STT</th>
                                            <th>KEY</th>
                                            <th>Họ và tên</th>
                                            <th>Ngày tạo</th>
                                            <th>HSD</th>
                                            <th>Tình trạng</th>
                                            <th>Hành động</th>
                                        </tr>
                                    `;
                                    dataKey.forEach(function (value, index) {
                                        let id, key_name, fullname_key, ngaytao, hsd;
                                        id = value.id;
                                        key_name = value.key_name;
                                        fullname_key = value.fullname_key;
                                        ngaytao = value.ngaytao;
                                        hsd = value.hsd;
                                        var tachNgay = ngaytao.split('-');
                                        var tachNgayEnd = hsd.split('-');
                                        var dateCreate = new Date(parseInt(tachNgay[0]), parseInt(tachNgay[1])-1, parseInt(tachNgay[2])+1);
                                        var dateEnd = new Date(parseInt(tachNgayEnd[0]), parseInt(tachNgayEnd[1])-1, parseInt(tachNgayEnd[2])+1);
                                        var today = new Date();
                                        contentTable += `
                                            <tr>
                                                <td>${index+1}</td>
                                                <td>${key_name}</td>
                                                <td>${fullname_key}</td>
                                                <td>${ngaytao}</td>
                                                <td>${hsd}</td>
                                                <td>${today > dateEnd ? '<h5 style="color:red">Hết hạn</h5>' : '<h5 style="color:green">Còn hạn</h5>'}</td>
                                                <td><button onclick="removeKey(${id})">Xóa key</button></td>
                                            </tr>
                                        
                                        `;
                                    });
                                    contentTable += '</table>';
                                    data = data.replace(PanelKey, contentTable);
                                    res.end(data);
                                }
                            }).catch(function (err) {
                                showLog(err.sqlMessage);
                                data = 'Cannot request';
                                res.end(data);
                            });
                    }
                });
            } else {
                removeKey(con, qq.id).then(function (data) {
                    fs.readFile('./khoi_tao.html', 'utf-8', function (err, data) {
                        if(err) {
                            showLog('File chưa được khởi tạo hoặc chưa có [file: khoi_tao.html]');
                            res.end('Request cannot');
                        } else {
                            showLog('Key có id ' + qq.id + ' đã bị loại khỏi hệ thống!');
                            data = data.replace(StatusCreateKey, 'Chưa có thông báo gì')
                            .replace(StatusPanelKey, 'Xóa key thành công!');
                            showAllKey(con).then(function (dataKey) {
                                if (dataKey.length == 0) {
                                    data = data.replace(PanelKey, 'Chưa có key nào được khởi tạo!');
                                    res.end(data);
                                } else {
                                    console.log(dataKey);
                                    var contentTable = '<table>';
                                    contentTable += `
                                        <tr>
                                            <th>STT</th>
                                            <th>KEY</th>
                                            <th>Họ và tên</th>
                                            <th>Ngày tạo</th>
                                            <th>HSD</th>
                                            <th>Tình trạng</th>
                                            <th>Hành động</th>
                                        </tr>
                                    `;
                                    dataKey.forEach(function (value, index) {
                                        let id, key_name, fullname_key, ngaytao, hsd;
                                        id = value.id;
                                        key_name = value.key_name;
                                        fullname_key = value.fullname_key;
                                        ngaytao = value.ngaytao;
                                        hsd = value.hsd;
                                        var tachNgay = ngaytao.split('-');
                                        var tachNgayEnd = hsd.split('-');
                                        var dateCreate = new Date(parseInt(tachNgay[0]), parseInt(tachNgay[1])-1, parseInt(tachNgay[2])+1);
                                        var dateEnd = new Date(parseInt(tachNgayEnd[0]), parseInt(tachNgayEnd[1])-1, parseInt(tachNgayEnd[2])+1);
                                        var today = new Date();
                                        contentTable += `
                                            <tr>
                                                <td>${index+1}</td>
                                                <td>${key_name}</td>
                                                <td>${fullname_key}</td>
                                                <td>${ngaytao}</td>
                                                <td>${hsd}</td>
                                                <td>${today > dateEnd ? '<h5 style="color:red">Hết hạn</h5>' : '<h5 style="color:green">Còn hạn</h5>'}</td>
                                                <td><button onclick="removeKey(${id})">Xóa key</button></td>
                                            </tr>
                                        
                                        `;
                                    });
                                    contentTable += '</table>';
                                    data = data.replace(PanelKey, contentTable);
                                    res.end(data);
                                }
                            }).catch(function (err) {
                                showLog(err.sqlMessage);
                                data = 'Cannot request';
                                res.end(data);
                            });
                        }
                    });
                }).catch (function (err) {
                    data = data.replace(StatusCreateKey, 'Chưa có thông báo gì')
                            .replace(StatusPanelKey, 'Xóa key không thành công!');
                            showAllKey(con).then(function (dataKey) {
                                if (dataKey.length == 0) {
                                    data = data.replace(PanelKey, 'Chưa có key nào được khởi tạo!');
                                    res.end(data);
                                } else {
                                    console.log(dataKey);
                                    var contentTable = '<table>';
                                    contentTable += `
                                        <tr>
                                            <th>STT</th>
                                            <th>KEY</th>
                                            <th>Họ và tên</th>
                                            <th>Ngày tạo</th>
                                            <th>HSD</th>
                                            <th>Tình trạng</th>
                                            <th>Hành động</th>
                                        </tr>
                                    `;
                                    dataKey.forEach(function (value, index) {
                                        let id, key_name, fullname_key, ngaytao, hsd;
                                        id = value.id;
                                        key_name = value.key_name;
                                        fullname_key = value.fullname_key;
                                        ngaytao = value.ngaytao;
                                        hsd = value.hsd;
                                        var tachNgay = ngaytao.split('-');
                                        var tachNgayEnd = hsd.split('-');
                                        var dateCreate = new Date(parseInt(tachNgay[0]), parseInt(tachNgay[1])-1, parseInt(tachNgay[2])+1);
                                        var dateEnd = new Date(parseInt(tachNgayEnd[0]), parseInt(tachNgayEnd[1])-1, parseInt(tachNgayEnd[2])+1);
                                        var today = new Date();
                                        contentTable += `
                                            <tr>
                                                <td>${index+1}</td>
                                                <td>${key_name}</td>
                                                <td>${fullname_key}</td>
                                                <td>${ngaytao}</td>
                                                <td>${hsd}</td>
                                                <td>${today > dateEnd ? '<h5 style="color:red">Hết hạn</h5>' : '<h5 style="color:green">Còn hạn</h5>'}</td>
                                                <td><button onclick="removeKey(${id})">Xóa key</button></td>
                                            </tr>
                                        
                                        `;
                                    });
                                    contentTable += '</table>';
                                    data = data.replace(PanelKey, contentTable);
                                    res.end(data);
                                }
                            }).catch(function (err) {
                                showLog(err.sqlMessage);
                                data = 'Cannot request';
                                res.end(data);
                            });
                });
            }
        } else if (query.pathname == '/check_key') {
            var qq = query.query;
            getKey(con, qq.key).then(function (data){
                res.writeHead(200, {
                    'Content-Type': 'Application/json'
                });
                res.end(exportJson({
                    code: 1,
                    Message: 'Key co ton tai trong he thong',
                    Info: {
                        'id_key': data.id,
                        'key': data.key_name,
                        'full_name': data.fullname_key,
                        'create_date': data.ngaytao,
                        'exp_date': data.hsd
                    }
                }));
            }).catch(function (err) {
                res.writeHead(200, {
                    'Content-Type': 'Application/json'
                });
                res.end(exportJson({
                    code: 2,
                    Message: 'Key khong ton tai trong he thong!'
                }));
            })
        } else {
            res.writeHead(404, {
                'Content-Type': 'text/html'
            });
            res.end('page not found');
        }
    }).listen(setup.port);
}


function exportJson (object) {
    return JSON.stringify(object, 4, 2);
}

function getKey (con, key) {
    return new Promise(function (resolve, reject) {
        showAllKey(con).then(function (data) {
            let key_return, status_check_key;
            status_check_key = false;
            for (let i = 0; i < data.length; i++) {
                if (data[i].key_name == key) 
                {   resolve(data[i]); break; status_check_key = true; }
            
            }
            if (status_check_key == false) reject(data);
        }).catch (function (err) {
            reject(err);
        });
    })
}
function removeKey (con, id) {
    return new Promise(function (resolve, reject) {
        var commands = 'DELETE FROM quan_ly_key WHERE `quan_ly_key`.`id` = ' + id;
        con.query(commands, function (err, data) {
            if(err) {
                reject(err);
            } else {
                resolve(data);
            }
        })
    })
}
function createKey (con, keyname, key, exp) {
    // get date 
    var date = new Date();
    var startDate = date.getFullYear() + '-' + (
        date.getMonth() + 1 < 10 ? '0' + (date.getMonth() + 1) : (date.getMonth() + 1)
    ) + '-' + date.getDate();
    
    return new Promise(function (resolve, reject) {
        con.query('SELECT * FROM quan_ly_key', function (err, data) {
            var statusCheckExistKey = false;
            data.forEach(function (value, index) {
                if (value.key_name == key) {
                    statusCheckExistKey = true;
                }
            });
            if (statusCheckExistKey == false) {
                var commands = `INSERT INTO quan_ly_key (key_name, fullname_key, ngaytao, hsd) VALUES ('${key}', '${keyname}', '${startDate}', '${exp}')`;
                con.query(commands, function (err, data) {
                    if (err) {
                        reject(err);
                    } else {
                        resolve(data);
                    }
                });    
                resolve(data);
            } else {
                showLog('Key đã bị trùng!');
                reject({
                    Message: 'Key đã tồn tại!',
                });
            }
            
        });
        
    })
}



function showAllKey (con) {
    return new Promise(function (resolve, reject) {
        con.query('SELECT * FROM quan_ly_key', function (err, data) {
            if (err) reject(err);
            else resolve(data);
        })
    })
}

function createTable (con) {
    return new Promise(function (resolve, reject) {
        con.query('CREATE TABLE quan_ly_key (id INT AUTO_INCREMENT PRIMARY KEY, key_name VARCHAR(255), fullname_key VARCHAR(255), ngaytao VARCHAR(255), hsd VARCHAR(255))', function (err, data) {
            if (err) reject(err);
            else resolve(data);
        });
    })
}
function createDatabase (con, nameDatabase) {
    return new Promise (function (resolve, reject) {
        con.query('CREATE DATABASE ' + nameDatabase, function (err, data) {
            if (err) reject(err);
            else resolve(data);
        });
    })
}

function getAllTables (con) {
    return new Promise(function (resolve, reject) {
        con.query('SHOW TABLES;', function (err, data) {
            if (err) {
                reject(err);
            } else {
                resolve(data);
            }
        });
    }); 
}
function getAllDatabase (con) {
    return new Promise(function (resolve, reject) {
        con.query('SHOW DATABASES;', function (err, data) {
            if (err) {
                reject(err);
            } else {
                resolve(data);
            }
        });
    }); 
    
}
function showLog (Message) {
    console.log('[+] => ' + Message);
}