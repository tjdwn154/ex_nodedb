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
require('dotenv').config();

var db;

MongoClient.connect(process.env.DB_URL,
  function (err, client) {
    if(err){
      return console.log(err)
    }
    db = client.db('todoapp');

    app.listen(process.env.PORT, function () {
      console.log("listening on 8080");
    });
  });

app.get("/", function (req, res) {
  res.render('index.ejs');
});

app.get("/write", checklogin, function (req, res) {
  res.render('write.ejs');
});

// /add로 post req하면 DB의 총게시물갯수 데이터를 가져와서 _id에 총게시물갯수+1으로 새로운 데이터를 post라는 컬렉션에 저장
app.post("/add", function (req, res) {
  res.send(
    "<script>alert('등록되었습니다.');location.href='/list';</script>"
  );
  db.collection('counter').findOne({name : '게시물갯수'},function(err, data){
    var 총게시물갯수 = data.totalPost;
    
    //post라는 컬렉션에 id,제목,등록일 기록
    db.collection("post").insertOne(
      { _id: 총게시물갯수 + 1, 제목: req.body.title, 등록일: req.body.date, 내용: req.body.contents, 주소: req.body.contentimg},
      function (err, data) {
        console.log("전송 완료");
        //counter라는 컬렉션에 있는 totalPost 라는 항목을 1증가
        db.collection('counter').updateOne({name : '게시물갯수'},{$inc : {totalPost : 1}},function(err, data){
          if(err){return console.log(err)}
        });
      }
    );
  });
});

//DB에 저장된 post라는 컬렉션안의 모든데이터(find()) 꺼내기
app.get('/list', checklogin, function(req, res){
  db.collection("post").find().toArray(function(err, data){
      res.render("list.ejs", { posts: data });
  }); 
})

//검색
app.get('/search', (req, res)=>{
  var search_ad = [
    {
      $search: {
        index: 'titleSearch',
        text: {
          query: req.query.value,
          path: '제목'
        }
      }
    },
    //검색data를 DB의 id순으로 정렬
    { $sort : { _id: 1}}
  ]
  db.collection('post').aggregate(search_ad).toArray(function(err,data){
    res.render('search.ejs', {posts : data})
  })
})

app.delete('/delete', checklogin, function(req, res){
  console.log(req.body)
  req.body._id = parseInt(req.body._id);
  //req.body에 담겨있는 게시물번호를 가진 글을 DB에서 찾아 삭제
  db.collection('post').deleteOne(req.body,function(err, data){
    console.log('삭제완료');
    res.status(200).send({ message : '완료되었습니다.'});
  })
})

app.get('/detail/:id', checklogin, function (req, res) {
  db.collection('post').findOne({ _id: parseInt(req.params.id) }, function (err, data) {
      if(data){
        res.render("detail.ejs", { data: data });
      }
      else{
        res.status(404).send("<h1>요청한 데이터는 없습니다.</h1>");
      }
    })
});

app.get("/edit/:id", checklogin, function (req, res) {
  db.collection("post").findOne(
    { _id: parseInt(req.params.id) },
    function (err, data) {
      res.render("edit.ejs", { post: data });
    }
  );
});

// 폼에 담긴 제목데이터 날짜 데이터를 가지고 db.collection에 업데이트($set)함
app.put("/edit", checklogin, function (req, res) {
  db.collection("post").updateOne(
    { _id: parseInt(req.body.id) },
    { $set: { 제목: req.body.title, 등록일: req.body.date, 내용: req.body.contents, 주소: req.body.contentimg } },
    function () {
      console.log("수정완료");
      res.redirect("/list");
    }
  );
}); 

app.get('/login',function(req, res){
  res.render('login.ejs')
})

app.post(
  "/login",
  passport.authenticate("local", {
    successRedirect: "/",
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
        function (err, data) {
          if (err) return done(err);

          if (!data)
            return done(null, false, { message: "존재하지않는 아이디요" });
          if (입력한비번 == data.userpw) {
            return done(null, data);
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
      db.collection('login').findOne({userid : 아이디}, function(err, data){
        done(null, data);
      })
    })

app.get('/fail', function(req, res){
  res.send(
    "<script>alert('정보를 다시 확인 부탁드립니다.');location.href='/login';</script>"
  );
})

function checklogin(req, res, next){
  if(req.user){
    next()
  }else{
    res.render('checklogin.ejs')
  }
}

app.get('/register',function(req, res){
  res.render('register.ejs')
})

app.post('/register', function(req, res){
  db.collection('login').findOne( {userid : req.body.userid}, function(err, data){
    if (data == null) {
      db.collection("login").insertOne({
        userid: req.body.userid,
        userpw: req.body.userpw,
      },function(err,data){
        res.render('index.ejs', {정보 : req.user})
      });
    } else {
      res.send(
        "<script>alert('이미 가입된 아이디입니다.');location.href='/register';</script>"
      );
    }})
})