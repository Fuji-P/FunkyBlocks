"use strict";

let ctx;				//グラフィックコンテキスト
let tiles = [];			//タイルオブジェクトを格納する二次元配列
let moves = [];			//移動中のタイルを保持する配列
let mIndex = 0;			//メッセージへのインデックス(=何連鎖中かを保持)
let mCount = 0;			//メッセージフェードアウト効果を演出するためのカウンタ
let times = [];			//残り時間画像を格納する配列
let timer = NaN;		//タイマー
let startTime = NaN;	//ゲーム開始時刻
let elapsed = 0;		//経過時間
let score = 0;			//スコア
let bgimage;			//背景画像
let sound;				//ブロックが消えたときの効果音
let mouseX = null;		//マウス押下時のX座標
let mouseY = null;		//マウス押下時のY座標
let mouseUpX = null;	//マウスリリース時のX座標
let mouseUpY = null;	//マウスリリース時のY座標
let message = ["", "good", "very good", "super", "wonderful!", "geart!!", "amazing", "brilliant", "excellent!!"];

function rand(v) {
	return Math.floor(Math.random() * v);
}

//引数に関数オブジェクトを取り、すべてのタイルについてその関数を実行
function iterate(f) {
	for (let x = 0; x < 12; x++) {
		for (let y = 0; y < 12; y++) {
			f(x, y, tiles[x][y]);
		}
	}
}

//タイルオブジェクト
function Tile(x, y) {
	//現在の座標
	this.x = x;
	this.y = y;
	//移動先の座標
	this.px = x;
	this.py = y;
	//移動までのカウンタ
	this.count = 0;
	//描画座標を返すメソッド(countの値によってオフセットを調整)
	this.getX = function () {
		return this.x + (this.px - this.x) * (this.count) / 20;
	}
	this.getY = function() {
		return this.y + (this.py - this.y) * (this.count) / 20;
	}
	//タイルを視覚的に移動させるメソッド
	this.move = function (px, py, color) {
		//移動先の座標を指定
		this.px = px;
		this.py = py;
		//移動先の色を指定
		this.color = color;
		this.count = 20;
		this.moving = true;
		//移動タイル格納配列movesに自分を挿入
		moves.push(this);
	}
	//カウントをデクリメントし0になったときにフラグをfalseに戻す
	this.update = function () {
		if (--this.count <= 0) {
			this.moving = false;
		}
	}
}

function init() {
	//タイルオブジェクトの生成
	for (let x = 0; x < 12; x++) {
		tiles[x] = [];
		for (let y = 0; y < 12; y++) {
			tiles[x][y] = new Tile(x, y);
		}
	}
	//3つ連続しないよう初期色の配置
	iterate(function (x, y, t) {
		while (true) {
			//色を5色から乱数で選ぶ
			let r = rand(5);
			//色を設定できた場合
			if (setColor(x, y, r)) {
				t.color = r;
				break;
			}
		}
	});
	//残り時間初期化
	for (let i = 0; i < 15; i++) {
		//残り時間の画像の配列を作成
		let t = document.createElement("img");
		t.src = "time" + i + ".png";
		//times配列に格納
		times.push(t);
	}
	//Canvas初期化
	bgimage = document.getElementById("bgimage");
	let canvas = document.getElementById("canvas");
	ctx = canvas.getContext("2d");
	ctx.textAlign = "center";
	sound = document.getElementById("sound");
	//描画
	repaint();
}

//ゲームを開始する関数
function go() {
	//マウスやタッチのイベントハンドラを登録
	let canvas = document.getElementById("canvas");
	canvas.onmousedown = mymousedown;
	canvas.onmouseup = mymouseup;
	canvas.addEventListener('touchstart', mymousedown);
	canvas.addEventListener('touchmove', mymousemove);
	canvas.addEventListener('touchend', mymouseup);
	startTime = new Date();
	//メインループtickを25msecごとに呼び出し
	timer = setInterval(tick, 25);
	document.body.addEventListener('touchmove', function (event) {
		event.preventDefault();
	}, false);
	document.getElementById("START").style.display = "none";
	document.getElementById("bgm").play();
}

//メインループ
function tick() {
	//メッセージフェードアウト効果
	mCount = Math.max(0, mCount - 1);
	//メッセージが消えたとき
	if (mCount == 0) {
		//連鎖をクリア
		mIndex = 0;
	}
	//移動中のタイルの有無
	if (moves.length > 0) {
		//タイル移動
		for (let i = 0; i < moves.length; i++) {
			//すべてのタイルの状態を更新
			moves[i].update();
		}
		//移動中のタイルのみ抽出
		moves = moves.filter(function (t) {
			return t.count != 0;
		});
		//移動完了
		if (moves.length == 0) {
			//3つ以上連続したタイル消去
			let s = removeTile();
			//消去したタイルの枚数が0より大きい場合
			if (s > 0) {
				//初回 or 連鎖
				mIndex = Math.min(message.length - 1, mIndex + 1);
				mCount = 50;
				score += s * 10 + mIndex * s * 100;
				//音を鳴らす
				sound.pause();
				sound.currentTime = 0;
				sound.play();
			}
			fall();
		}
	}
	//69秒(BGMの再生時間)を超えたときにゲーム終了
	elapsed = ((new Date()).getTime() - startTime) / 1000;
	if (elapsed > 69) {
		clearInterval(timer);
		timer = NaN;
	}
	repaint();
}

//初期化時に色を設定
function setColor(x, y, c) {
	//上下左右に3つ以上同じ色が隣り合わない場合にtrue
	let flag = true;
	//左
	if (1 < x) {
		let c0 = tiles[x - 2][y].color;
		let c1 = tiles[x - 1][y].color;
		flag &= !(c0 == c1 && c1 == c);
	}
	//右
	if (x < 8) {
		let c0 = tiles[x + 2][y].color;
		let c1 = tiles[x + 1][y].color;
		flag &= !(c0 == c1 && c1 == c);
	}
	//上
	if (1 < y) {
		let c0 = tiles[x][y - 2].color;
		let c1 = tiles[x][y - 1].color;
		flag &= !(c0 == c1 && c1 == c);
	}
	//下
	if (y < 8) {
		let c0 = tiles[x][y + 2].color;
		let c1 = tiles[x][y + 1].color;
		flag &= !(c0 == c1 && c1 == c);
	}
	return flag;
}

//マウス押下時、タッチ操作時の座標を格納
function mymousedown(e) {
	mouseX = !isNaN(e.offsetX) ? e.offsetX : e.touches[0].clientX;
	mouseY = !isNaN(e.offsetY) ? e.offsetY : e.touches[0].clientY;
}

//タイルを移動する場合、マウス押下時とリリース時の座標を比較してどの方向に操作されたか
function mymousemove(e) {
	mouseUpX = !isNaN(e.offsetX) ? e.offsetX : e.touches[0].clientX;
	mouseUpY = !isNaN(e.offsetY) ? e.offsetY : e.touches[0].clientY;
}

//マウスが離されたときのコールバック
function mymouseup(e) {
	//マウス押下時にどのタイルが選択されたか
	let sx = Math.floor((mouseX - 34) / 44);
	let sy = Math.floor((mouseY - 36) / 44);
	let nx = sx;
	let ny = sy;
	//リリース時の座標
	let mx = !isNaN(e.offsetX) ? e.offsetX : mouseUpX;
	let my = !isNaN(e.offsetY) ? e.offsetY : mouseUpY;
	//y軸方向よりもx軸方向への移動量が多い
	if (Math.abs(mx - mouseX) > Math.abs(my - mouseY)) {
		nx += (mx - mouseX > 0) ? 1 : -1;
	//x軸方向よりもy軸方向への移動量が多い
	} else {
		ny += (my - mouseY > 0) ? 1 : -1;
	}
	//移動先の座標が範囲外の場合、もしくはタイルが移動中である場合
	if (nx > 11 || ny > 11 || nx < 0 || ny < 0 ||
		tiles[sx][sy].moving || tiles[nx][ny].moving) {
			return;
	}
	//それぞれのタイルの場所と色を入れ替える処理を開始
	let c = tiles[sx][sy].color;
	tiles[sx][sy].move(nx, ny, tiles[nx][ny].color);
	tiles[nx][ny].move(sx, sy, c);
	repaint();
}

function removeTile() {
	//縦横3つ以上連続するタイルにremoveフラグをセット
	//横方向
	//上から1行ずつ調査
	for (let y = 0; y < 12; y++) {
		//左端の色
		let c0 = tiles[0][y].color;
		//連続数を示すcount
		let count = 1;
		//「x = 1」として隣のタイルから調査
		for (let x = 1; x < 12; x++) {
			//タイルの色を格納
			let c1 = tiles[x][y].color;
			//色が違う場合
			if (c0 != c1) {
				c0 = c1;
				count = 1;
			//色が同じ場合
			} else {
				if (++count >= 3) {
					tiles[x - 2][y].remove = true;
					tiles[x - 1][y].remove = true;
					tiles[x - 0][y].remove = true;
				}
			}
		}
	}
	//縦方向
	for (let x = 0; x < 12; x++) {
		let c0 = tiles[x][0].color;
		let count = 1;
		for (let y = 1; y < 12; y++) {
			let c1 = tiles[x][y].color;
			if (c0 != c1) {
				c0 = c1;
				count = 1;
			} else {
				if (++count >= 3) {
					tiles[x][y - 2].remove = true;
					tiles[x][y - 1].remove = true;
					tiles[x][y - 0].remove = true;
				}
			}
		}
	}
	let score = 0;
	//removeプロパティがtrueに設定されたタイルの数を数える
	iterate(function (x, y, t) {
		if (t.remove) {
			score++;
		}
	});
	return score;
}

//落下処理
function fall() {
	//x軸方向として、左列から右列へ順番に処理を行う
	for (let x = 0; x < 12; x++) {
		//y軸方向として、下から上方向へ順番に処理を行う
		//yは現在のタイルを示す値で11から0まで順番に減らす
		//spは落下元のタイルを示す値
		for (let y = 11, sp = 11; y >= 0; y--, sp--) {
			while (sp >= 0) {
				//removeのタイルがある場合、spはそれをスキップするために更にデクリメントする
				if (tiles[x][sp].remove) {
					sp--;
				} else {
					break;
				}
			}
			//yとspが違う場合、タイルが削除されたことを意味する
			if (y != sp) {
				//移動先tiles[x][sp]を、移動先tiles[x][y]にmoveする
				//spが0未満のときは落ちてくるタイルがないので乱数で色を決める
				let c = (sp >= 0) ? tiles[x][sp].color : rand(5);
				tiles[x][y].move(x, sp, c);
			}
		}
	}
	iterate(function (x, y, t) {
		t.remove = false;
	});
}

function repaint() {
	ctx.drawImage(bgimage, 0, 0);
	//タイル
	let images = [block0, block1, block2, block3, block4];
	iterate(function (x, y, t) {
		if (!t.remove) {
			ctx.drawImage(images[t.color], t.getX() * 44 + 34, t.getY() * 44 + 36, 42, 42);
		}
	});
	//メッセージ
	ctx.font = "bold 80px sans-serif";
	ctx.fillStyle = "rgba(255, 255, 255," + (mCount / 50) + ")";
	ctx.fillText(message[mIndex], 300, 300);
	ctx.fillStyle = "white";
	if (isNaN(timer)) {
		ctx.fillText("FINISH", 350, 300);
	}
	//スコア
	ctx.fillStyle = "rgba(220, 133, 30, 50)";
	ctx.font = "bold 50px sans-serif";
	ctx.fillText(('0000000' + score).slice(-7), 680, 170);
	//残り時間
	let index = Math.min(15, Math.floor(elapsed / (69 / 15)));
	ctx.drawImage(times[index], 615, 327);
}