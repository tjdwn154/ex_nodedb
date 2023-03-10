const express = require('express');
const app = express();
const bodyParser =require('body-parser');
app.use(bodyParser.urlencoded({extended : true}));
const methodOverride = require("method-override");
app.use(methodOverride("_method"));
const MongoClient = require('mongodb').MongoClient;
app.set('view engine', 'ejs');
app.use('/public', express.static('public'));

var db;

MongoClient.connect(
  "mongodb+srv://admin:tjdwnrk154@cluster0.iezb1as.mongodb.net/?retryWrites=true&w=majority",
  function (에러, client) {
    if(에러){
      return console.log(에러)
    }
    db = client.db('todoapp');

    app.listen(8080, function () {
      console.log("listening on 8080");
    });
  });

app.get("/", function (요청, 응답) {
  응답.render('index.ejs');
});

app.get("/write", function (요청, 응답) {
  응답.render('write.ejs');
});

// /add로 post 요청하면 DB의 총게시물갯수 데이터를 가져와서 _id에 총게시물갯수+1으로 새로운 데이터를 post라는 컬렉션에 저장
app.post("/add", function (요청, 응답) {
  응답.send("전송 완료");
  db.collection('counter').findOne({name : '게시물갯수'},function(에러, 결과){
    var 총게시물갯수 = 결과.totalPost;
    
    //post라는 컬렉션에 id,제목,등록일 기록
    db.collection("post").insertOne(
      { _id: 총게시물갯수 + 1, 제목: 요청.body.title, 등록일: 요청.body.date },
      function (에러, 결과) {
        console.log("전송 완료");
        //counter라는 컬렉션에 있는 totalPost 라는 항목을 1증가
        db.collection('counter').updateOne({name : '게시물갯수'},{$inc : {totalPost : 1}},function(에러, 결과){
          if(에러){return console.log(에러)}
        });
      }
    );
  });
});

//DB에 저장된 post라는 컬렉션안의 모든데이터(find()) 꺼내기
app.get('/list', function(요청, 응답){

  db.collection("post").find().toArray(function(에러, 결과){
      응답.render("list.ejs", { posts: 결과 });
  }); 
})

app.delete('/delete', function(요청, 응답){
  console.log(요청.body)
  요청.body._id = parseInt(요청.body._id);
  //요청.body에 담겨있는 게시물번호를 가진 글을 DB에서 찾아 삭제
  db.collection('post').deleteOne(요청.body,function(에러, 결과){
    console.log('삭제완료');
    응답.status(200).send({ message : '완료되었습니다.'});
  })
})

app.get('/detail/:id', function (요청, 응답) {
  db.collection('post').findOne({ _id: parseInt(요청.params.id) }, function (에러, 결과) {
      if(결과){
        응답.render("detail.ejs", { data: 결과 });
      }
      else{
        응답.status(404).send("<h1>요청한 데이터는 없습니다.</h1>");
      }
    })
});

app.get("/edit/:id", function (요청, 응답) {
  db.collection("post").findOne(
    { _id: parseInt(요청.params.id) },
    function (에러, 결과) {
      응답.render("edit.ejs", { post: 결과 });
    }
  );
});

// 폼에 담긴 제목데이터 날짜 데이터를 가지고 db.collection에 업데이트($set)함
app.put("/edit", function (요청, 응답) {
  db.collection("post").updateOne(
    { _id: parseInt(요청.body.id) },
    { $set: { 제목: 요청.body.title, 등록일: 요청.body.date } },
    function () {
      console.log("수정완료");
      응답.redirect("/list");
    }
  );
}); 