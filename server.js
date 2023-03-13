const express = require('express');
const app = express();
const bodyParser =require('body-parser');
app.use(bodyParser.urlencoded({extended : true}));
const methodOverride = require("method-override");
app.use(methodOverride("_method"));
const MongoClient = require('mongodb').MongoClient;
app.set('view engine', 'ejs');
app.use('/public', express.static('public'));
const passport = require('passport');
const LocalStrategy = require('passport-local').Strategy;
const session = require('express-session');
app.use(session({ secret: "비밀코드", resave: true, saveUninitialized: false }));
app.use(passport.initialize());
app.use(passport.session());

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

app.get("/write", checklogin, function (요청, 응답) {
  응답.render('write.ejs');
});

// /add로 post 요청하면 DB의 총게시물갯수 데이터를 가져와서 _id에 총게시물갯수+1으로 새로운 데이터를 post라는 컬렉션에 저장
app.post("/add", function (요청, 응답) {
  응답.render('list.ejs');
  db.collection('counter').findOne({name : '게시물갯수'},function(에러, 결과){
    var 총게시물갯수 = 결과.totalPost;
    
    //post라는 컬렉션에 id,제목,등록일 기록
    db.collection("post").insertOne(
      { _id: 총게시물갯수 + 1, 제목: 요청.body.title, 등록일: 요청.body.date, 내용: 요청.body.contents },
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
app.get('/list', checklogin, function(요청, 응답){
  db.collection("post").find().toArray(function(에러, 결과){
      응답.render("list.ejs", { posts: 결과 });
  }); 
})

app.delete('/delete', checklogin, function(요청, 응답){
  console.log(요청.body)
  요청.body._id = parseInt(요청.body._id);
  //요청.body에 담겨있는 게시물번호를 가진 글을 DB에서 찾아 삭제
  db.collection('post').deleteOne(요청.body,function(에러, 결과){
    console.log('삭제완료');
    응답.status(200).send({ message : '완료되었습니다.'});
  })
})

app.get('/detail/:id', checklogin, function (요청, 응답) {
  db.collection('post').findOne({ _id: parseInt(요청.params.id) }, function (에러, 결과) {
      if(결과){
        응답.render("detail.ejs", { data: 결과 });
      }
      else{
        응답.status(404).send("<h1>요청한 데이터는 없습니다.</h1>");
      }
    })
});

app.get("/edit/:id", checklogin, function (요청, 응답) {
  db.collection("post").findOne(
    { _id: parseInt(요청.params.id) },
    function (에러, 결과) {
      응답.render("edit.ejs", { post: 결과 });
    }
  );
});

// 폼에 담긴 제목데이터 날짜 데이터를 가지고 db.collection에 업데이트($set)함
app.put("/edit", checklogin, function (요청, 응답) {
  db.collection("post").updateOne(
    { _id: parseInt(요청.body.id) },
    { $set: { 제목: 요청.body.title, 등록일: 요청.body.date, 내용: 요청.body.contents } },
    function () {
      console.log("수정완료");
      응답.redirect("/list");
    }
  );
}); 

app.get('/login',function(요청, 응답){
  응답.render('login.ejs')
})

app.post(
  "/login",
  passport.authenticate("local", {
    successRedirect: "/mypage",
    failureRedirect: "/fail",
  }));

//로그인 인증
passport.use(new LocalStrategy({
      usernameField: "userid",
      passwordField: "userpw",
      session: true,
      passReqToCallback: false,
    },
    function (입력한아이디, 입력한비번, done) {
      //console.log(입력한아이디, 입력한비번);
      db.collection("login").findOne(
        { userid: 입력한아이디 },
        function (에러, 결과) {
          if (에러) return done(에러);

          if (!결과)
            return done(null, false, { message: "존재하지않는 아이디요" });
          if (입력한비번 == 결과.userpw) {
            return done(null, 결과);
          } else {
            return done(null, false, { message: "비번틀렸어요" });
          }
        });
    }));

    passport.serializeUser(function(user, done){
      done(null, user.userid)
    });
    
    //DB에서 위에있는 user.userid로 유저를 찾은뒤 유저 정보를 저장
    passport.deserializeUser(function(아이디, done){
      db.collection('login').findOne({userid : 아이디}, function(에러, 결과){
        done(null, 결과);
      })
    })

app.get('/fail', function(요청, 응답){
  응답.render('loginfail.ejs')
})

app.get('/mypage', checklogin, function(요청, 응답){
  console.log(요청.user)
  응답.render('mypage.ejs', {사용자 : 요청.user})
})

function checklogin(요청, 응답, next){
  if(요청.user){
    next()
  }else{
    응답.render('checklogin.ejs')
  }
}

app.get('/register',function(요청, 응답){
  응답.render('register.ejs')
})

app.post('/register', function(요청, 응답){
  db.collection('login').findOne( {userid : 요청.body.userid}, function(에러, 결과){
    if (결과 == null) {
      db.collection("login").insertOne({
        userid: 요청.body.userid,
        userpw: 요청.body.userpw,
      },function(에러,결과){
        응답.render('index.ejs', {정보 : 요청.user})
      });
    } else {
      응답.send( {message: '이미 존재합니다.'} );
    }})
})