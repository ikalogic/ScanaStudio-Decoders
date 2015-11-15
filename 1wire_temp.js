/*
*************************************************************************************

				 SCANASTUDIO 2 1-WIRE MAXIM TEMP SENSORS DECODER

The following commented block allows some related informations to be displayed online

<DESCRIPTION>

    1-Wire Temperature Sensors decoder. Supported sensors: DS1820, DS18B20, DS18S20, DS1822, DS1825, DS1920, DS2438, DS2760, DS28EA00, MAX31820, MAX31826 and MAX318(50/51).

</DESCRIPTION>

<RELEASE_NOTES>

	V1.21: Now the decoding can be aborted
	V1.2: Corrected a bug related to CRC calculations (Thanks to Petar Pasti)
    V1.1: Added Packet/Hex View support.
	V1.0: Initial release.

</RELEASE_NOTES>

<AUTHOR_URL>

	mailto:v.kosinov@ikalogic.com

</AUTHOR_URL>

*************************************************************************************
*/


/* The decoder name as it will apear to the users of this script
*/
function get_dec_name()
{
	return "1-Wire Temperature Sensors";
}


/* The decoder version
*/
function get_dec_ver()
{
	return "1.21";
}


 /* The decoder version
 */
function get_dec_auth()
{
	return "IKALOGIC";
}


/* graphical user interface
*/
function gui()
{
	ui_clear();	// clean up the User interface before drawing a new one
	
	ui_add_ch_selector("uiCh", "Channel to decode", "1-Wire");

	ui_add_txt_combo("uiSpeed", "Speed");
		ui_add_item_to_txt_combo("Regular speed", true);
		ui_add_item_to_txt_combo("Overdrive speed");

    ui_add_txt_combo("uiDevice", "Device");
    
    for (var k in DEVICE_TABLE)
    {
        var dev = DEVICE_TABLE[k];

        if (k == 0)
        {
            ui_add_item_to_txt_combo(dev.str, true);
        }
        else
        {
            ui_add_item_to_txt_combo(dev.str);
        }
    }

    ui_add_txt_combo("uiTempUnit", "Temperature Units");
        ui_add_item_to_txt_combo("Celsius", true);
        ui_add_item_to_txt_combo("Fahrenheit");
        ui_add_item_to_txt_combo("Kelvin");

    ui_add_num_combo("uiTempRes", "Temperature Resolution (bits) *", 9, 12, 12);

    ui_add_info_label("* This option may not be applicable to all devices, in this case it will be ignored");
}


/* Constants
*/
var DEVICE_TABLE =
{
    DS1820   : {uiId: 0,  code: 0x10, grp: 3, str: "DS1820"},
    DS18B20  : {uiId: 1,  code: 0x28, grp: 1, str: "DS18B20"},
    DS18S20  : {uiId: 2,  code: 0x10, grp: 3, str: "DS18S20"},
    DS1822   : {uiId: 3,  code: 0x22, grp: 1, str: "DS1822"},
    DS1825   : {uiId: 4,  code: 0x3B, grp: 1, str: "DS1825"},
    DS1920   : {uiId: 5,  code: 0x10, grp: 3, str: "DS1920"},
    DS2438   : {uiId: 6,  code: 0x26, grp: 4, str: "DS2438"},
    DS2760   : {uiId: 7,  code: 0x30, grp: 5, str: "DS2760"},
    S28EA00  : {uiId: 8,  code: 0x42, grp: 1, str: "DS28EA00"},
    MAX31820 : {uiId: 9,  code: 0x28, grp: 1, str: "MAX31820"},
    MAX31826 : {uiId: 10, code: 0x3B, grp: 1, str: "MAX31826"},
    MAX31850 : {uiId: 11, code: 0x3B, grp: 2, str: "MAX318(50/51)"},
}

var DEV_CMD = 
{
    CONVERT_T      : 0x44,
    WR_SCRATCH     : 0x4E,
    RD_SCRATCH     : 0xBE,
    CPY_SCRATCH    : 0x48,
    RECALL_E       : 0xB8,
    RD_POWER       : 0xB4,
    DS2760_RD_DATA : 0x69,
    DS2760_LOCK    : 0x6A,
    DS2760_WR_DATA : 0x6C
};

var TEMP_RESOLUTION =
{
    B9  : {val:  9, tempRes: 0.5},
    B10 : {val: 10, tempRes: 0.25},
    B11 : {val: 11, tempRes: 0.125},
    B12 : {val: 12, tempRes: 0.0625}
};


/* Global variables
*/
var owData;
var objCnt;
var decBuf;
var Device;

var PKT_COLOR_DATA;
var PKT_COLOR_DATA_TITLE;
var PKT_COLOR_RESET_TITLE;
var PKT_COLOR_PRES_TITLE;
var PKT_COLOR_ROMCMD_TITLE;
var PKT_COLOR_ROMCODE_TITLE;
var PKT_COLOR_UNKNW_TITLE;
var PKT_COLOR_OTHER_TITLE;


/* This is the function that will be called from ScanaStudio
   to update the decoded items
*/
function decode()
{
    get_ui_vals();
    uiTempRes += 9;

    if (!check_scanastudio_support())
    {
        add_to_err_log("Please update your ScanaStudio software to the latest version to use this decoder");
        return;
    }

    PKT_COLOR_DATA          = get_ch_light_color(uiCh);
    PKT_COLOR_DATA_TITLE    = dark_colors.gray;
    PKT_COLOR_CMD_TITLE     = dark_colors.orange;
    PKT_COLOR_ROMCODE_TITLE = dark_colors.blue;

    for (var k in DEVICE_TABLE)
    {
        var dev = DEVICE_TABLE[k];

        if (dev.uiId == uiDevice)
        {
            Device = dev;
        }
    }

	decBuf = pre_decode("1wire.js", "uiCh = " + uiCh + ";" + "uiSpeed = " + uiSpeed + ";" + "uiHexView = " + 3);

    objCnt = 0;
    
    while (decBuf.length > objCnt)
    {
        var skipRom = false;
        var rightDeviceRom = false;

        owData = decBuf[objCnt];
        objCnt++;

	    if (abort_requested() == true)	// Allow the user to abort this script
		{
			return false;
		}

        if (owData.pre_text.indexOf("SKIP") != -1)
        {
            skipRom = true;
        }

        if (owData.pre_text.indexOf(Device.str) != -1)
        {
            rightDeviceRom = true;
        }

        if (rightDeviceRom == true || skipRom == true)
        {
            pkt_start("1-WIRE TEMP");

            if (rightDeviceRom == true)
            {
                var st = owData.start_s;
                var romCode = int_to_str_hex((+owData.data));
                var crc = "WRONG";

                for (var i = 0; i < 7; i++)
                {
                    owData = decBuf[objCnt];
                    objCnt++;

                    if (owData.data.length > 0)
                    {
                        romCode += ", " + int_to_str_hex((+owData.data));
                    }

                    if (owData.pre_text.indexOf("CRC") != -1)
                    {
                        if (owData.post_text.indexOf("OK") != -1)
                        {
                            crc = "OK";
                        }
                    }
                }

                var end = owData.end_s;

                dec_item_new(uiCh, st, end);
                dec_item_add_pre_text(Device.str + " ROM CODE: {" + romCode + "}  CRC: " + crc);
                dec_item_add_pre_text(Device.str + " ROM CODE");
                pkt_add_item(-1, -1, "ROM CODE", Device.str, PKT_COLOR_ROMCODE_TITLE, PKT_COLOR_DATA);
            }
            else
            {
                dec_item_new(uiCh, owData.start_s, owData.end_s);
                dec_item_add_pre_text(owData.pre_text);
            }

            owData = decBuf[objCnt];
            objCnt++;

            dec_item_new(uiCh, owData.start_s, owData.end_s);

            if (owData.data.length > 0)
            {
                switch (+owData.data)
                {
                    case DEV_CMD.CONVERT_T:

                        dec_item_add_pre_text("CMD: CONVERT TEMP");
                        dec_item_add_pre_text("CMD");
                        pkt_add_item(-1, -1, "COMMAND", "CONVERT TEMP", PKT_COLOR_CMD_TITLE, PKT_COLOR_DATA);

                    break;

                    case DEV_CMD.WR_SCRATCH:
                    case DEV_CMD.RD_SCRATCH:
                    case DEV_CMD.DS2760_RD_DATA:
                    case DEV_CMD.DS2760_WR_DATA:

                        if (+owData.data == DEV_CMD.WR_SCRATCH || +owData.data == DEV_CMD.DS2760_WR_DATA)
                        {
                            dec_item_add_pre_text("CMD: WRITE SCRATCHPAD");
                            dec_item_add_pre_text("CMD: WRITE");
                            pkt_add_item(-1, -1, "COMMAND", "WRITE SCRATCHPAD", PKT_COLOR_CMD_TITLE, PKT_COLOR_DATA);
                        }
                        else if (+owData.data == DEV_CMD.RD_SCRATCH || +owData.data == DEV_CMD.DS2760_RD_DATA)
                        {
                            dec_item_add_pre_text("CMD: READ SCRATCHPAD");
                            dec_item_add_pre_text("CMD: READ");
                            pkt_add_item(-1, -1, "COMMAND", "READ SCRATCHPAD", PKT_COLOR_CMD_TITLE, PKT_COLOR_DATA);
                        }

                        dec_item_add_pre_text("CMD");

                        switch (Device.grp)
                        {
                            case 1: decode_grp1(); break
                            case 2: decode_grp2(); break
                            case 3: decode_grp3(); break
                            case 4: decode_grp4(); break
                            case 4: decode_grp5(); break
                        }

                    break;

                    case DEV_CMD.CPY_SCRATCH:

                        dec_item_add_pre_text("CMD: COPY SCRATCHPAD");
                        dec_item_add_pre_text("CMD: COPY SCRATCH");
                        dec_item_add_pre_text("CMD");
                        pkt_add_item(-1, -1, "COMMAND", "COPY SCRATCHPAD", PKT_COLOR_CMD_TITLE, PKT_COLOR_DATA);

                    break;

                    case DEV_CMD.RECALL_E:

                        dec_item_add_pre_text("CMD: RECALL E2");
                        dec_item_add_pre_text("CMD: RECALL");
                        dec_item_add_pre_text("CMD");
                        pkt_add_item(-1, -1, "COMMAND", "RECALL E2", PKT_COLOR_CMD_TITLE, PKT_COLOR_DATA);

                    break;

                    case DEV_CMD.RD_POWER:

                        dec_item_add_pre_text("CMD: READ POWER");
                        dec_item_add_pre_text("CMD: READ PWR");
                        dec_item_add_pre_text("CMD");
                        pkt_add_item(-1, -1, "COMMAND", "READ POWER", PKT_COLOR_CMD_TITLE, PKT_COLOR_DATA);

                    break;

                    case DS2760_LOCK:

                        dec_item_add_pre_text("CMD: LOCK");
                        dec_item_add_pre_text("CMD");
                        pkt_add_item(-1, -1, "COMMAND", "LOCK", PKT_COLOR_CMD_TITLE, PKT_COLOR_DATA);

                    break;


                    default:

                        dec_item_add_pre_text("CMD: UNKNOWN");
                        dec_item_add_pre_text("UNKNOWN");
                        dec_item_add_pre_text("UNK");
                        pkt_add_item(-1, -1, "COMMAND", "UNKNOWN", PKT_COLOR_CMD_TITLE, PKT_COLOR_DATA);

                    break;
                }
            }

            pkt_end();
        }
        else
        {
            dec_item_new(uiCh, owData.start_s, owData.end_s);
            dec_item_add_pre_text(owData.pre_text + owData.post_text);

            if (owData.data.length > 0)
            {
                dec_item_add_data(owData.data);
            }
        }
	}
}


/* */
function get_sratchpad (maxLenght)
{
    var scratchPad = new Array();

    while ((scratchPad.length < maxLenght) && (owData.data.length > 0))
    {
        owData = decBuf[objCnt];
        objCnt++;

        if (owData.data.length > 0)
        {
            scratchPad.push(owData);
            hex_add_byte(uiCh, owData.start_s, owData.end_s, +owData.data);
        }
        else
        {
            dec_item_new(uiCh, owData.start_s, owData.end_s);
            dec_item_add_pre_text(owData.pre_text);
        }
    }

    if (scratchPad.length > 0)
    {
        return scratchPad;
    }
    else
    {
        return false;
    }
}


/* */
function decode_grp1()
{
    var scratchPad = get_sratchpad(9);

    if (scratchPad == false)
    {
        return false;
    }
   
    var strComplete, strShort, strCrc = false;
    var st = scratchPad[0].start_s, end = scratchPad[scratchPad.length - 1].end_s;

    if (scratchPad.length >= 9)     // Calc CRC if there are all 9 scratchpad bytes
    {
        var crc = scratchPad[8].data;
        var calcCrc = get_scratchpad_crc8(scratchPad);
        strCrc = "CRC: ";

        if (crc != calcCrc)
        {
            strCrc += "WRONG";
        }
        else
        {
            strCrc += "OK";
        }
    }

    if (scratchPad.length >= 2)         // If there are at least 2 temperature bytes
    {
        var tempLsb = scratchPad.shift().data;
        var tempMsb = scratchPad.shift().data;
        var temp = (tempLsb | (tempMsb << 8));
        var tempRes = 0;

        for (var k in TEMP_RESOLUTION)
        {
            var res = TEMP_RESOLUTION[k];

            if (uiTempRes == res.val)
            {
                tempRes = res.tempRes;
            }
        }

        var tempSign = "+";

        if ((temp & (1 << 15)) != 0)    // Detect if temp is negative
        {
            temp = (0xFFFF - temp) + 1;
            tempSign = "-";
        }

        temp = temp * tempRes;

        strComplete = "TEMP: " + get_formatted_temp(tempSign, temp);
        strShort = get_formatted_temp(tempSign, temp);

        if (scratchPad.length >= 2)
        {
            var tempH = scratchPad.shift().data;
            var tempL = scratchPad.shift().data;
            var tempSignH = "+", tempSignL = "+";

            tempH = (tempH << 4);
            tempL = (tempL << 4);

            if ((tempH & (1 << 11)) != 0)
            {
                tempH = (0xFFFF - tempH) + 1;
                tempSignH = "-";
            }

            if ((tempL & (1 << 11)) != 0)
            {
                tempL = (0xFFFF - tempL) + 1;
                tempSignL = "-";
            }

            tempH = tempH * tempRes;
            tempL = tempL * tempRes;

            if (Device.str.indexOf("MAX31826") == -1)           // MAX31826 doesn't have 2 alarm temp bytes
            {
                strComplete += "  ALARM TEMP: {HIGH: " + get_formatted_temp(tempSignH, tempH) + ", LOW: " + get_formatted_temp(tempSignL, tempL) + "}";
            }

            if (scratchPad.length >= 1)
            {
                var confReg = scratchPad.shift();
                confReg.data = (confReg.data >> 5);
                confReg.data += 0x09;

                if (Device.str.indexOf("MAX31826") == -1)       // MAX31826 can not change temp resolution
                {
                    strComplete += "  TEMP RES: " + confReg.data + " bits";
                }
            }
        }

        if (strCrc != false)
        {
            strComplete += " " + strCrc;
        }

        dec_item_new(uiCh, st, end);
        dec_item_add_pre_text(strComplete);
        dec_item_add_pre_text(strShort);
        pkt_add_item(-1, -1, "TEMP DATA", strComplete, PKT_COLOR_DATA_TITLE, PKT_COLOR_DATA);
    }
}


/* */

function decode_grp2()
{
    
    var scratchPad = get_sratchpad(9);

    if (scratchPad == false)
    {
        return false;
    }

    var strComplete, strShort, strCrc = false;
    var st = scratchPad[0].start_s, end = scratchPad[scratchPad.length - 1].end_s;

    if (scratchPad.length >= 9)     // Calc CRC if there are all 9 scratchpad bytes
    {
        var crc = scratchPad[8].data;
        var calcCrc = get_scratchpad_crc8(scratchPad);
        strCrc = "CRC: ";

        if (crc != calcCrc)
        {
            strCrc += "WRONG";
        }
        else
        {
            strCrc += "OK";
        }
    }

    if (scratchPad.length >= 2)         // If there are at least 2 temperature bytes
    {
        var tempLsb = scratchPad.shift().data;
        var tempMsb = scratchPad.shift().data;
        var temp = (tempLsb | (tempMsb << 8));
        var fault = (temp & (1 << 0));
        var tcoupleTempRes = 0.25;
        var tempSign = "+";

        if ((temp & (1 << 15)) != 0)    // Detect if temp is negative
        {
            temp = (0xFFFF - temp) + 1;
            tempSign = "-";
        }

        temp = temp >> 2;               // Skip eserved and fault bits
        temp = temp * tcoupleTempRes;
        strShort = get_formatted_temp(tempSign, temp);
        strComplete = "THERMOCOUPLE TEMP: " + get_formatted_temp(tempSign, temp);

        if (scratchPad.length >= 2)
        {
            var intTempRes = 0.0625;    // 12-bit res

            tempLsb = scratchPad.shift().data;
            tempMsb = scratchPad.shift().data;
            temp = (tempLsb | (tempMsb << 8));

            var faultOpen = (temp & (1 << 0));
            var faultVdd = (temp & (1 << 1));
            var faultGnd = (temp & (1 << 2));

            tempSign = "+";

            if ((temp & (1 << 15)) != 0)
            {
                temp = (0xFFFF - temp) + 1;
                tempSign = "-";
            }

            temp = (temp >> 4);
            temp = temp * intTempRes;
            strShort += " " + get_formatted_temp(tempSign, temp)
            strComplete += "  INTERNAL TEMP: " + get_formatted_temp(tempSign, temp);

            if (scratchPad.length >= 1)
            {
                var confAdr = scratchPad.shift().data;
                strComplete += "  ADR: " + confAdr;
            }
        }

        if (strCrc != false)
        {
            strComplete += " " + strCrc;
        }

        if (fault >= 1)
        {
            strShort = "FAULT";
            strComplete = strShort;

            if (faultOpen >= 1)
            {
                strComplete += ": OPEN CIRCUIT";
            }

            if (faultGnd >= 1)
            {
                strComplete +=  ": SHORT TO GND";
            }

            if (faultVdd >= 1)
            {
                strComplete +=  ": SHORT TO VDD";
            }
        }

        dec_item_new(uiCh, st, end);
        dec_item_add_pre_text(strComplete);
        dec_item_add_pre_text(strShort);
        pkt_add_item(-1, -1, "TEMP DATA", strComplete, PKT_COLOR_DATA_TITLE, PKT_COLOR_DATA);
    }
}


/* */
function decode_grp3()
{
    var scratchPad = get_sratchpad(9);

    if (scratchPad == false)
    {
        return false;
    }

    var rawTemp, realTemp = false;
    var strComplete, strShort, strCrc = false;
    var st = scratchPad[0].start_s, end = scratchPad[scratchPad.length - 1].end_s;

    if (scratchPad.length >= 9)                 // Calc CRC if there are all 9 scratchpad bytes
    {
        var crc = scratchPad[8].data;
        var calcCrc = get_scratchpad_crc8(scratchPad);
        strCrc = "CRC: ";

        if (crc != calcCrc)
        {
            strCrc += "WRONG";
        }
        else
        {
            strCrc += "OK";
        }
    }

    if (scratchPad.length >= 2)                 // If there are at least 2 temperature bytes
    {
        var tempLsb = scratchPad.shift().data;
        var tempMsb = scratchPad.shift().data;
        rawTemp = (tempLsb | (tempMsb << 8));
        var tempRes = 0.5;                      // 9-bit res
        var tempSign = "+";

        if ((rawTemp & (1 << 15)) != 0)         // Detect if temp is negative
        {
            rawTemp = (0xFFFF - rawTemp) + 1;
            tempSign = "-";
        }

        rawTemp = rawTemp * tempRes;

        strComplete = "TEMP: " + get_formatted_temp(tempSign, rawTemp);
        strShort = get_formatted_temp(tempSign, rawTemp);

        if (scratchPad.length >= 2)
        {
            var tempH = scratchPad.shift().data;
            var tempL = scratchPad.shift().data;
            var tempSignH = "+", tempSignL = "+";

            tempH = (tempH << 1);
            tempL = (tempL << 1);

            if ((tempH & (1 << 8)) != 0)
            {
                tempH = (0xFFFF - tempH) + 1;
                tempSignH = "-";
            }

            if ((tempL & (1 << 8)) != 0)
            {
                tempL = (0xFFFF - tempL) + 1;
                tempSignL = "-";
            }

            tempH = tempH * tempRes;
            tempL = tempL * tempRes;

            strComplete += "  ALARM TEMP: {HIGH: " + get_formatted_temp(tempSignH, tempH) + ", LOW: " + get_formatted_temp(tempSignL, tempL) + "}";

            if (scratchPad.length >= 4)
            {
                var reserved = scratchPad.shift().data;
                reserved = scratchPad.shift().data;

                var countRemain = scratchPad.shift().data;
                var countPerC = scratchPad.shift().data;
                var tempRead = (rawTemp >> 1);

                var temp = (tempRead - 0.25) + ((countPerC - countRemain) / countPerC);

                var newStr = strComplete.split(" ");

                if (newStr.length > 0)
                {
                    newStr[1] =  get_formatted_temp(tempSign, temp);
                }

                strComplete = "";

                for (var i = 0; i < newStr.length; i++)
                {
                    strComplete += newStr[i] + " ";
                }
            }
        }

        dec_item_new(uiCh, st, end);
        dec_item_add_pre_text(strComplete);
        dec_item_add_pre_text(strShort);
        pkt_add_item(-1, -1, "TEMP DATA", strComplete, PKT_COLOR_DATA_TITLE, PKT_COLOR_DATA);
    }
}


/* */
function decode_grp4()
{
    if (Device.str.indexOf("DS2438") != -1)
    {
        var scratchPad = get_sratchpad(4);          // Page Addr + 3 scratchpad bytes

        if (scratchPad == false)
        {
            return false;
        }

        var strComplete, strShort, strCrc = false;
        var st = scratchPad[0].start_s, end = scratchPad[scratchPad.length - 1].end_s;
        var pageAddr = scratchPad.shift().data;

        if (pageAddr == 0x00)                       // Only the first page contains temp, ignore other pages
        {
            if (scratchPad.length >= 1)
            {
                var confReg = scratchPad.shift().data;

                if (confReg & (1 << 4) >= 1)        // Temp Busy flag
                {
                    strComplete = "TEMP CONVERSION IN PROGRESS";
                    strShort = "IN PROGRESS";
                }
                else
                {
                    strComplete = "TEMP CONVERSION COMPLETE";
                    strShort = "COMPLETE";
                }

                if (scratchPad.length >= 2)
                {
                    var tempLsb = scratchPad.shift().data;
                    var tempMsb = scratchPad.shift().data;
                    var temp = (tempLsb | (tempMsb << 8));
                    var tempRes = 0.03125;    // 13-bit temp res
                    var tempSign = "+";

                    temp = (temp >> 3);       // Skip first empty bits

                    if ((temp & (1 << 13)) != 0)
                    {
                        temp = (0xFFFF - temp) + 1;
                        tempSign = "-";
                    }

                    temp = temp * tempRes;
                    strComplete = ": " + get_formatted_temp(tempSign, temp);
                    strShort = ": " + get_formatted_temp(tempSign, temp);
                }

                dec_item_new(uiCh, st, end);
                dec_item_add_pre_text(strComplete);
                dec_item_add_pre_text(strShort);
                pkt_add_item(-1, -1, "TEMP DATA", strComplete, PKT_COLOR_DATA_TITLE, PKT_COLOR_DATA);
            }
        }
    }
}


/* */
function decode_grp5()
{
    if (Device.str.indexOf("DS2760") != -1)
    {
        var scratchPad = get_sratchpad(3);          // Addr + 2 temp bytes

        if (scratchPad == false)
        {
            return false;
        }

        var strComplete, strShort, strCrc = false;
        var st = scratchPad[0].start_s, end = scratchPad[scratchPad.length - 1].end_s;
        var addr = scratchPad.shift().data;

        if (addr == 0x18)   // 18 - temp MSB addr
        {
            if (scratchPad.length >= 2)
            {
                var tempMsb = scratchPad.shift().data;
                var tempLsb = scratchPad.shift().data;
                var temp = (tempLsb | (tempMsb << 8));
                var tempRes = 0.125;
                var tempSign = "+";

                temp = (temp >> 5);

                if ((temp & (1 << 10)) != 0)
                {
                    temp = (0xFFFF - temp) + 1;
                    tempSign = "-";
                }

                temp = temp * tempRes;
                strComplete = "TEMP: " + get_formatted_temp(tempSign, temp);
                strShort = get_formatted_temp(tempSign, temp);

                dec_item_new(uiCh, st, end);
                dec_item_add_pre_text(strComplete);
                dec_item_add_pre_text(strShort);
                pkt_add_item(-1, -1, "TEMP DATA", strComplete, PKT_COLOR_DATA_TITLE, PKT_COLOR_DATA);
            }
        }
    }
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
function get_ch_light_color (k)
{
    var chColor = get_ch_color(k);

    chColor.r = (chColor.r * 1 + 255 * 3) / 4;
    chColor.g = (chColor.g * 1 + 255 * 3) / 4;
    chColor.b = (chColor.b * 1 + 255 * 3) / 4;

    return chColor;
}


/* */
function get_formatted_temp (sign, temp)
{
    var tempStr;

    switch (uiTempUnit)
    {
        case 0: if (temp == 0)
                {
                    sign = "";
                }

                tempStr = sign + temp + "°C";
                break;

        case 1: var fahTemp = ((temp * (9 / 5)) + 32);

                if ((temp < 17.8) && (sign.indexOf("-") != -1))
                {
                    sign = "+";
                }

                if (fahTemp == 0)
                {
                    sign = "";
                }

                tempStr = sign + fahTemp + "°F";
                break;

        case 2: tempStr = (temp + 273.15) + "K";
                break;
    }

    return tempStr;
}


/*  CRC8 algorithm for one byte
*/
function compute_crc8 (data, seed)
{
    var temp;

    for (var i = 8; i > 0; i--)
    {
        temp = ((seed ^ data) & 0x01);

        if(temp == 0)
        {
            seed >>= 1;
        }
        else
        {
            seed ^= 0x18;
            seed >>= 1;
            seed |= 0x80;
        }
        data >>= 1;
    }

    return seed;
}


/*  Get 8-byte crc
*/
function get_scratchpad_crc8 (buf)
{
    var crc;
    
    for (var i = 0; i < 8; i++)
    {
        crc = compute_crc8(buf[i].data, crc);
    }
    
    return crc;
}
