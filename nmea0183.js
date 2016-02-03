/*
*************************************************************************************

							SCANASTUDIO 2 NMEA 0183 DECODER

The following commented block allows some related informations to be displayed online

<DESCRIPTION>

	NMEA 0183 Protocol Decoder.
	A standard  decoder of National Marine Electronics Association Protocol for communication between marine electronic devices such as echo sounder, 
	sonars, anemometer, gyrocompass, autopilot, GPS receivers and many other types of instruments. 

</DESCRIPTION>

<RELEASE_NOTES>

	V1.2: Fixed some minor bugs. Added support of GPGGA, GPGSV and GPRMC frames.
	V1.1: Added Packet/Hex View support.
	V1.0: Initial release.

</RELEASE_NOTES>

<AUTHOR_URL>

	mailto:v.kosinov@ikalogic.com

</AUTHOR_URL>
						
*************************************************************************************
*/

/*
*************************************************************************************
								      INFO
*************************************************************************************
*/

 /* The decoder name as it will apear to the users of this script
 */
function get_dec_name()
{
	return "NMEA 0183";
}


 /* The decoder version
 */
function get_dec_ver()
{
	return "1.2";
}


 /* The decoder version
 */
function get_dec_auth()
{
	return "IKALOGIC";
}

/*
*************************************************************************************
							    GLOBAL VARIABLES
*************************************************************************************
*/

var PKT_COLOR_DATA;
var PKT_COLOR_GENER_TITLE;
var PKT_COLOR_GPGGA_TITLE;
var PKT_COLOR_GPGSA_TITLE;
var PKT_COLOR_GPGSV_TITLE;
var PKT_COLOR_GPRMC_TITLE;

/*
*************************************************************************************
								   DECODER
*************************************************************************************
*/

/* graphical user interface
*/
function gui()
{
	ui_clear();	// clean up the User interface before drawing a new one.
	
	ui_add_ch_selector("ch", "Channel to decode", "NMEA");
	ui_add_baud_selector("baud", "BAUD rate", 9600);

	ui_add_txt_combo("invert","Inverted logic");
		ui_add_item_to_txt_combo("Non inverted logic",true);
		ui_add_item_to_txt_combo("Inverted logic");

}


/* This is the function that will be called from ScanaStudio
   to update the decoded items
*/
function decode()
{
	var uartData;
	var uartDataCnt = 0;

	if (!check_scanastudio_support())
    {
        add_to_err_log("Please update your ScanaStudio software to the latest version to use this decoder");
        return;
    }

	PKT_COLOR_DATA        = get_ch_light_color(ch);
	PKT_COLOR_GENER_TITLE = dark_colors.gray;
	PKT_COLOR_GPGGA_TITLE = dark_colors.blue;
	PKT_COLOR_GPGSA_TITLE = dark_colors.orange;
	PKT_COLOR_GPGSV_TITLE = dark_colors.green;
	PKT_COLOR_GPRMC_TITLE = dark_colors.violet;

	get_ui_vals();
	
	var decBuf = pre_decode("uart.js", "ch = " + ch + ";"
                                    + "baud = " + baud + ";"
									+ "nbits = " + 3 + ";"		// 8-bit word
									+ "parity = " + 0 + ";"		// no parity
									+ "stop = " + 0 + ";"       // 1 stop
									+ "order = " + 0 + ";"      // LSB first
									+ "invert = " + 0);			// non inverted

	while (decBuf.length > uartDataCnt)
	{
		uartData = decBuf[uartDataCnt];
		uartDataCnt++;

		if (uartData.data.length > 0)
		{
			if (String.fromCharCode(uartData.data) == "$")
			{
				var msg = String.fromCharCode(uartData.data);
				var stOfMsg = uartData.start_s, endOfMsg;

				while ((String.fromCharCode(uartData.data) != "\r") && (decBuf.length > uartDataCnt))
				{
					uartData = decBuf[uartDataCnt];
					uartDataCnt++;

					endOfMsg = uartData.end_s;

					if (uartData.data.length > 0)
					{
						hex_add_byte(ch, -1, -1, uartData.data);
						msg += String.fromCharCode(uartData.data);
					}
				}

				var outMsgArr = msg.split(",");
				var msgId = outMsgArr.shift();
				msgId = msgId.slice(1);

				dec_item_new(ch, stOfMsg , endOfMsg);
				dec_item_add_pre_text(msg);
				dec_item_add_pre_text(msgId);

				pkt_start("NMEA 0183");

				if (msgId == "GPGGA")
				{
					pkt_add_item(-1, -1, msgId, "", PKT_COLOR_GPGGA_TITLE, PKT_COLOR_DATA);
					pkt_start(msgId);

					var utc = outMsgArr.shift();

					if (utc.length > 0)
					{
						utc = utc.slice(0, 2) + ":" +  utc.slice(2, 4) + ":" + utc.slice(4, 6) + "." + utc.slice(7, 10);
					}

					add_pkt_data(utc, "", "UTC TIME", PKT_COLOR_GPGGA_TITLE);

					var latitude = outMsgArr.shift();
					var ns = outMsgArr.shift();

					if (latitude.length > 0)
					{
						latitude = latitude.slice(0, 2) + "°" + latitude.slice(2, 4) + "'" + latitude.slice(5, 9) + '"';
					}

					add_pkt_data(latitude, ns, "LATITUDE", PKT_COLOR_GPGGA_TITLE);

					var longitude = outMsgArr.shift();
					var ew = outMsgArr.shift();

					if (longitude.length > 0)
					{
						longitude = longitude.slice(0, 2) + "°" + longitude.slice(2, 4) + "'" + longitude.slice(5, 9) + '"';
					}

					add_pkt_data(longitude, ew, "LONGITUDE", PKT_COLOR_GPGGA_TITLE);

					var posFix = outMsgArr.shift();
					var posFixStr;

					switch (posFix)
					{
						case "0": posFixStr = "Fix not available or invalid"; break;
						case "1": posFixStr = "SPS Mode"; break;
						case "2": posFixStr = "Diff SPS Mode"; break;
						case "3": posFixStr = "PPS Mode"; break;
					}

					add_pkt_data(posFixStr, "", "POS FIX IND", PKT_COLOR_GPGGA_TITLE);

					var satNum = outMsgArr.shift();
					add_pkt_data(satNum, "", "TOTAL SAT", PKT_COLOR_GPGGA_TITLE);

					var hdop = outMsgArr.shift();
					add_pkt_data(satNum, "", "HDOP", PKT_COLOR_GPGGA_TITLE);

					var altitude = outMsgArr.shift();
					var units = outMsgArr.shift();
					add_pkt_data(altitude, (" " + units), "ALTITUDE", PKT_COLOR_GPGGA_TITLE);

					var geoid = outMsgArr.shift();
					units = outMsgArr.shift();
					add_pkt_data(geoid, (" " + units), "GEOID SEP", PKT_COLOR_GPGGA_TITLE);

					var ageDiff = outMsgArr.shift();
					add_pkt_data(ageDiff, "", "AGE DIFF", PKT_COLOR_GPGGA_TITLE);

					var checksum = verify_checksum(msg);
					pkt_add_item(-1, -1, "CHECKSUM", checksum, PKT_COLOR_GPGGA_TITLE, PKT_COLOR_DATA);

					pkt_end();
				}

				if (msgId == "GPGSV")
				{
					pkt_add_item(-1, -1, msgId, "", PKT_COLOR_GPGSV_TITLE, PKT_COLOR_DATA);
					pkt_start(msgId);

					var numMsg = outMsgArr.shift();					
					add_pkt_data(numMsg, "", "TOTAL MSG", PKT_COLOR_GPGSV_TITLE);

					var msgNum = outMsgArr.shift();
					add_pkt_data(msgNum, "", "MSG NUM", PKT_COLOR_GPGSV_TITLE);

					var satNum = outMsgArr.shift();
					add_pkt_data(satNum, "", "TOTAL SAT", PKT_COLOR_GPGSV_TITLE);

					do
					{
						var satId = outMsgArr.shift();
						add_pkt_data(satId, "", "SAT ID", PKT_COLOR_GPGSV_TITLE);
						if (outMsgArr[0] == "*") break;

						var elevation = outMsgArr.shift();						
						add_pkt_data(elevation, " deg", "ELEVATION", PKT_COLOR_GPGSV_TITLE);
						if (outMsgArr[0] == "*") break;

						var azimuth = outMsgArr.shift();
						add_pkt_data(azimuth, " deg", "AZIMUTH", PKT_COLOR_GPGSV_TITLE);
						if (outMsgArr[0] == "*") break;

						var snr = outMsgArr.shift();
						add_pkt_data(azimuth, " dB", "SNR", PKT_COLOR_GPGSV_TITLE);
						if (outMsgArr[0] == "*") break;

					} while (outMsgArr.length > 0);

					var checksum = verify_checksum(msg);
					pkt_add_item(-1, -1, "CHECKSUM", checksum, PKT_COLOR_GPGSV_TITLE, PKT_COLOR_DATA);

					pkt_end();
				}

				if (msgId == "GPRMC")
				{
					pkt_add_item(-1, -1, msgId, "", PKT_COLOR_GPRMC_TITLE, PKT_COLOR_DATA);
					pkt_start(msgId);

					if (isEmpty(outMsgArr)) break;
					var utc = outMsgArr.shift();

					if (utc.length > 0)
					{
						utc = utc.slice(0, 2) + ":" +  utc.slice(2, 4) + ":" + utc.slice(4, 6) + "." + utc.slice(7, 10);
					}

					add_pkt_data(utc, "", "UTC TIME", PKT_COLOR_GPRMC_TITLE);

					if (isEmpty(outMsgArr)) break;
					var stat = outMsgArr.shift();

					if (stat.length > 0)
					{
						if (stat == "A") 
						{
							stat = "data valid";
						}
						else if (stat == "V")
						{
							stat = "data not valid";
						}
						else
						{
							stat = "invalid arg";
						}	
					}

					add_pkt_data(stat, "", "STATUS", PKT_COLOR_GPRMC_TITLE);

					if (isEmpty(outMsgArr)) break;
					var latitude = outMsgArr.shift();
					if (isEmpty(outMsgArr)) break;
					var ns = outMsgArr.shift();

					if (latitude.length > 0)
					{
						latitude = latitude.slice(0, 2) + "°" + latitude.slice(2, 4) + "'" + latitude.slice(5, 9) + '"';
					}

					add_pkt_data(latitude, ns, "LATITUDE", PKT_COLOR_GPRMC_TITLE);

					if (isEmpty(outMsgArr)) break;
					var longitude = outMsgArr.shift();
					if (isEmpty(outMsgArr)) break;
					var ew = outMsgArr.shift();

					if (longitude.length > 0)
					{
						longitude = longitude.slice(0, 2) + "°" + longitude.slice(2, 4) + "'" + longitude.slice(5, 9) + '"';
					}

					add_pkt_data(longitude, ew, "LONGITUDE", PKT_COLOR_GPRMC_TITLE);

					if (isEmpty(outMsgArr)) break;
					var speed = outMsgArr.shift();
					add_pkt_data(speed, " knots", "SPEED", PKT_COLOR_GPRMC_TITLE);

					if (isEmpty(outMsgArr)) break;
					var course = outMsgArr.shift();
					add_pkt_data(course, " deg", "COURSE", PKT_COLOR_GPRMC_TITLE);

					if (isEmpty(outMsgArr)) break;
					var date = outMsgArr.shift();

					if (date.length > 0)
					{
						date = date.slice(0, 2) + "/" +  date.slice(2, 4) + "/" + date.slice(4, 6);
					}

					add_pkt_data(date, "", "DATE", PKT_COLOR_GPRMC_TITLE);

					if (isEmpty(outMsgArr)) break;
					var magVar = outMsgArr.shift();
					add_pkt_data(magVar, " deg", "MAGN VAR", PKT_COLOR_GPRMC_TITLE);

					if (isEmpty(outMsgArr)) break;
					var ewInd = outMsgArr.shift();
					add_pkt_data(ewInd, "", "E/W IND", PKT_COLOR_GPRMC_TITLE);

					if (isEmpty(outMsgArr)) break;
					var checksum = verify_checksum(msg);
					pkt_add_item(-1, -1, "CHECKSUM", checksum, PKT_COLOR_GPRMC_TITLE, PKT_COLOR_DATA);

					pkt_end();
				}

				pkt_end();
			}
		}
	}
}


/*
*/
function add_pkt_data (data, suffix, param, color)
{
	if (data !== undefined)
	{
		if (data.length > 0)
		{
			if (suffix.length > 0)
			{
				data = data + suffix;
			}
		}
		else
		{
			data = "none";
		}

		pkt_add_item(-1, -1, param, data, color, PKT_COLOR_DATA);
	}
}


/*
*/
function verify_checksum (data)
{	
	var str;

	if (data.indexOf('*') === -1)
	{
		str = "none";
	}
	else
	{
		var checksum1 = 0;
		var dataStr =  data.substring(data.lastIndexOf("$") + 1, data.lastIndexOf("*"));

		str = data.substring(data.lastIndexOf("*") + 1, data.lastIndexOf("\r"));
		var checksum2 = parseInt(str, 16);

		for (var i = 0; i < dataStr.length; i++) 
		{
			checksum1 = checksum1 ^ dataStr.charCodeAt(i);
		}

		if (str.length > 0)
		{
			str = "0x" + str;

			if (checksum1 == checksum2)
			{
				str = str + " (OK)";
			}
			else
			{
				str = str + " (WRONG)";
			}
		}
		else
		{
			str = "NONE";
		}
	}

	return str;
}


/*
*************************************************************************************
							        UTILS
*************************************************************************************
*/

/*
*/
function isEmpty (arr)
{
	if (arr.length > 0)
	{
		return false;
	}
	else
	{
		pkt_end();
		return true;
	}
}


/*
*/
function int_to_str_hex (num) 
{
	var temp = "0x";

	if (num < 0x10)
	{
		temp += "0";
	}

	temp += num.toString(16).toUpperCase();

	return temp;
}


/*
*/
function check_scanastudio_support()
{
    if (typeof(pkt_start) != "undefined")
    { 
        return true;
    }
    else
    {
        return false;
    }
}


/*
*/
function get_ch_light_color (k)
{
    var chColor = get_ch_color(k);

    chColor.r = (chColor.r * 1 + 255 * 3) / 4;
	chColor.g = (chColor.g * 1 + 255 * 3) / 4;
	chColor.b = (chColor.b * 1 + 255 * 3) / 4;

	return chColor;
}
