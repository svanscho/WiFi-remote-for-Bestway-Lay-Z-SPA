// the web socket connection
var connection;

// command mapping
const cmd = {
	setTarget: 0,
	toggleUnit: 1,
	toggleBubbles: 2,
	toggleHeater: 3,
	togglePump: 4,
	//resetq: 5,
	restartEsp: 6,
	//gettarget: 7,
	resetTotals: 8,
	resetTimerChlorine: 9,
	resetTimerFilter: 10,
	toggleHydroJets: 11,
	setBrightness: 12,
	setBeep: 13,
	setAmbient: 15,
	setAmbientF: 14,
	setAmbientC: 15
};

// button element ID mapping
const eid = {
	toggleUnit: 'UNT',
	toggleBubbles: 'AIR',
	toggleHeater: 'HTR',
	togglePump: 'FLT',
	toggleHydroJets: 'HJT'
};

// to be used for setting the slider position once after loading to original values
var initSlider = true;

// display brightness multiplier. lower value results lower brightness levels (1-30)
const dspBrtMultiplier = 16;

// initial connect to the web socket
connect();

function connect()
{
	connection = new WebSocket('ws://'+location.hostname+':81/', ['arduino']);

	connection.onopen = function()
	{
		document.getElementById('header').style = "background-color: #00508F";
		initSlider = true;
	};

	connection.onerror = function(error)
	{
		console.log('WebSocket Error ', error);
		document.getElementById('header').style = "background-color: #FF0000";
		connection.close();
	};

	connection.onclose = function()
	{
		console.log('WebSocket connection closed, reconnecting in 5 s');
		document.getElementById('header').style = "background-color: #FF0000";
		setTimeout(function(){connect()}, 5000);
	};

	connection.onmessage = function(e)
	{
		handlemsg(e);
	}
}

String.prototype.pad = function(String, len)
{
	var str = this;
	while (str.length < len)
	{
		str = String + str;
	}
	return str;
}

function handlemsg(e)
{
	var msgobj = JSON.parse(e.data);
	console.log(msgobj);

	if (msgobj.CONTENT == "OTHER")
	{
		// MQTT status
		mqtt_states = [
			"CONNECTION_TIMEOUT", // -4 / the server didn't respond within the keepalive time
			"CONNECTION_LOST", // -3 / the network connection was broken
			"CONNECT_FAILED", // -2 / the network connection failed
			"DISCONNECTED", // -1 / the client is disconnected cleanly
			"CONNECTED", // 0 / the client is connected
			"CONNECT_BAD_PROTOCOL", // 1 / the server doesn't support the requested version of MQTT
			"CONNECT_BAD_CLIENT_ID", // 2 / the server rejected the client identifier
			"CONNECT_UNAVAILABLE", // 3 / the server was unable to accept the connection
			"CONNECT_BAD_CREDENTIALS", // 4 / the username/password were rejected
			"CONNECT_UNAUTHORIZED" // 5 / the client was not authorized to connect
		]
		document.getElementById('mqtt').innerHTML = "MQTT: " + mqtt_states[msgobj.MQTT + 4];
		document.getElementById('fw').innerHTML = "Firmware version: " + msgobj.FW;
		document.getElementById('model').innerHTML = "Model: " + msgobj.MODEL;
		document.getElementById('rssi').innerHTML = "RSSI: " + msgobj.RSSI;

		// hydro jets available
		document.getElementById('jets').style.display = (msgobj.HASJETS ? 'table-row' : 'none');
		document.getElementById('jetstotals').style.display = (msgobj.HASJETS ? 'table-row' : 'none');
	}

	if (msgobj.CONTENT == "STATES")
	{
		// temperature
		document.getElementById('temp').min = (msgobj.UNT ? 20 : 68);
		document.getElementById('temp').max = (msgobj.UNT ? 40 : 104);
		document.getElementById('amb').min = (msgobj.UNT ? -10 : 14);;
		document.getElementById('amb').max = (msgobj.UNT ? 50 : 122);;
		document.getElementById('atlabel').innerHTML = msgobj.TMP.toString();
		document.getElementById('vtlabel').innerHTML = msgobj.VTM.toFixed(2).toString();
		document.getElementById('ttlabel').innerHTML = msgobj.TGT.toString();

		// buttons
		document.getElementById('AIR').checked = msgobj.AIR;
		if(document.getElementById('UNT').checked != msgobj.UNT) {
			document.getElementById('UNT').checked = msgobj.UNT;
			initSlider = true;
		}
		document.getElementById('FLT').checked = msgobj.FLT;
		document.getElementById('HJT').checked = msgobj.HJT;
		document.getElementById('HTR').checked = msgobj.RED || msgobj.GRN;

		// heater button color
		document.getElementById('htrspan').style = "background-color: #" + ((msgobj.RED) ? 'FF0000' : ((msgobj.GRN) ? '00FF00' : 'CCC'));

		// display
		document.getElementById('dsp').innerHTML = "[" + String.fromCharCode(msgobj.CH1,msgobj.CH2,msgobj.CH3)+ "]";
		document.getElementById('dsp').style.color = rgb((255-(dspBrtMultiplier*8))+(dspBrtMultiplier*(parseInt(msgobj.BRT)+1)), 0, 0);

		// set slider values (once)
		if (initSlider)
		{
			document.getElementById('temp').value = msgobj.TGT;
			document.getElementById('brt').value = msgobj.BRT;
			document.getElementById('amb').value = msgobj.AMB;
			initSlider = false;
		}
		document.getElementById('sliderTempVal').innerHTML = document.getElementById('temp').value.toString();
		document.getElementById('sliderBrtVal').innerHTML = document.getElementById('brt').value.toString();
		document.getElementById('sliderAmbVal').innerHTML = document.getElementById('amb').value.toString();
	}

	if (msgobj.CONTENT == "TIMES")
	{
		var date = new Date(msgobj.TIME * 1000);
		document.getElementById('time').innerHTML = date.toLocaleString();

		// chlorine add reset timer
		var clDate = (Date.now()/1000-msgobj.CLTIME)/(24*3600.0);
		document.getElementById('cltimer').innerHTML = clDate.toFixed(2);
		document.getElementById('cltimerbtn').className = (clDate > msgobj.CLINT ? "button_red" : "button");

		// filter change reset timer
		var fDate = (Date.now()/1000-msgobj.FTIME)/(24*3600.0);
		document.getElementById('ftimer').innerHTML = fDate.toFixed(2);
		document.getElementById('ftimerbtn').className = (fDate > msgobj.FINT ? "button_red" : "button");

		// statistics
		document.getElementById('heatingtime').innerHTML = s2dhms(msgobj.HEATINGTIME);
		document.getElementById('uptime').innerHTML = s2dhms(msgobj.UPTIME);
		document.getElementById('airtime').innerHTML = s2dhms(msgobj.AIRTIME);
		document.getElementById('filtertime').innerHTML = s2dhms(msgobj.PUMPTIME);
		document.getElementById('jettime').innerHTML = s2dhms(msgobj.JETTIME);
		document.getElementById('cost').innerHTML = (msgobj.COST).toFixed(2);
    document.getElementById('t2r').innerHTML = (msgobj.T2R);
		document.getElementById('tttt').innerHTML = (msgobj.TTTT/3600).toFixed(2) + "h<br>(" + new Date(msgobj.TIME * 1000 + msgobj.TTTT * 1000).toLocaleString() + ")";
	}
};

function s2dhms(val)
{
	var day = 3600*24;
	var hour = 3600;
	var minute = 60;
	var rem;
	var days = Math.floor(val/day);
	rem = val % day;
	var hours = Math.floor(rem/hour);
	rem = val % hour;
	var minutes = Math.floor(rem/minute);
	rem = val % minute;
	var seconds = Math.floor(rem);
	return days + "d " + hours.toString().pad("0", 2) + ":" + minutes.toString().pad("0", 2) + ":" + seconds.toString().pad("0", 2);
}

function sendCommand(val)
{
	// check command
	if (typeof(cmd[val]) == 'undefined')
	{
		console.log("invalid command");
		return;
	}

	// get and set value
	var value = 0;
	if (val == 'setTarget')
	{
		value = parseInt(document.getElementById('temp').value);
		document.getElementById("sliderTempVal").innerHTML = value.toString();
	}
	else if (val == 'setBrightness')
	{
		value = parseInt(document.getElementById('brt').value);
		document.getElementById("sliderBrtVal").innerHTML = value.toString();
		document.getElementById("dsp").style.color = rgb((255-(dspBrtMultiplier*8))+(dspBrtMultiplier*(value+1)), 0, 0);

	}
	else if (val == 'setAmbient')
	{
		value = parseInt(document.getElementById('amb').value);
		if(document.getElementById("UNT").checked) val = 'setAmbientC';
		else val = 'setAmbientF';
		document.getElementById("sliderAmbVal").innerHTML = value.toString();
	}
	else if (eid[val] && (val == 'toggleUnit' || val == 'toggleBubbles' || val == 'toggleHeater' || val == 'togglePump' || val == 'toggleHydroJets'))
	{
		value = document.getElementById(eid[val]).checked;
		initSlider = true;
	}

	var obj = {};
	obj["CMD"] = cmd[val];
	obj["VALUE"] = value;
	obj["XTIME"] = Math.floor(Date.now()/1000);
	obj["INTERVAL"] = 0;

	var json = JSON.stringify(obj);
	connection.send(json);
	console.log(json);
}

function rgb(r, g, b)
{
	r = Math.floor(r);
	g = Math.floor(g);
	b = Math.floor(b);
	return ["rgb(",r,",",g,",",b,")"].join("");
}
