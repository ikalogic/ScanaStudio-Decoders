/*
*************************************************************************************

                            SCANASTUDIO 2 DHT22 DECODER

The following commented block allows some related informations to be displayed online

<DESCRIPTION>

    DHT11 / DHT22 Protocol Decoder.
    A very simple protocol for the temperature humidity sensor. DHTxx generates 2 bytes 
    for humidity and 2 bytes for temperature. Data is stored in 10th deg and %.

</DESCRIPTION>

<RELEASE_NOTES>

	V1.16: Now the decoding can be aborted
    V1.15: Add Packet/Hex View support.
    V1.1:  Add DHT22 sensor support.
    V1.02: Add byte overlay as an option & increased tolerances for data definitions.
    V1.00: First release.

</RELEASE_NOTES>

<AUTHOR_URL>

    mailto:ianmac51@gmail.com
    mailto:rolf.ziegler@z-control.ch

</AUTHOR_URL>

*************************************************************************************
*/

/* The decoder name as it will appear to the users of this script 
*/
function get_dec_name()
{
    return "DHTxx"; 
}


/* The decoder version 
*/
function get_dec_ver()
{
    return "1.16";
}


/* Author 
*/
function get_dec_auth()
{
    return "IJM, RZI, IKALOGIC";
}


/* Graphical user interface for this decoder
*/
function gui()
{
    ui_clear(); // clean up the User interface before drawing a new one.

    ui_add_ch_selector("ch", "Channel to decode", "DHTxx");

    ui_add_txt_combo("sensor", "Sensor");
        ui_add_item_to_txt_combo("DHT11", true);
        ui_add_item_to_txt_combo("DHT22");

    ui_add_txt_combo("tempUnit", "Temperature Units");
        ui_add_item_to_txt_combo("Celsius", true);
        ui_add_item_to_txt_combo("Fahrenheit");
        ui_add_item_to_txt_combo("Kelvin");
}


/* Constants
*/
var DHT11 =
{
    DEVICE         : "DHT11",
    START          : 18000,
    WAIT_REPLY_MAX : 45,
    WAIT_REPLY_MIN : 19,
    BIT_ONE_MAX    : 75,
    BIT_ONE_MIN    : 65,
    BIT_ZERO_MAX   : 28,
    BIT_ZERO_MIN   : 20
};

var DHT22 =
{
    DEVICE         : "DHT22",
    START          : 500,
    WAIT_REPLY_MAX : 41,
    WAIT_REPLY_MIN : 19,
    BIT_ONE_MAX    : 80,
    BIT_ONE_MIN    : 60,
    BIT_ZERO_MAX   : 30,
    BIT_ZERO_MIN   : 20
};


/* Global variables
*/
var DHTxx;

var PKT_COLOR_DATA;
var PKT_COLOR_WAKEUP_TITLE;
var PKT_COLOR_WAIT_TITLE;
var PKT_COLOR_START_TITLE;
var PKT_COLOR_HUM_TITLE;
var PKT_COLOR_TEMP_TITLE;
var PKT_COLOR_CHECK_TITLE;


/* This is the function that will be called from ScanaStudio 
   to update the decoded items
*/
function decode()
{
    get_ui_vals();                  // Get user interface options
    clear_dec_items();              // Clear decoder items

    var t = new transition(0, 0);   // create a new variable t of type "Transition"
    var trStart;                    // Start of transition value
    var next;                       // next transition value so that next - trStart gives number of samples
    var tranLen;                    // Length of the transition in samples

    if (!check_scanastudio_support())
    {
        add_to_err_log("Please update your ScanaStudio software to the latest version to use this decoder");
        return;
    }

    PKT_COLOR_DATA         = get_ch_light_color(ch);
    PKT_COLOR_WAKEUP_TITLE = dark_colors.green;
    PKT_COLOR_WAIT_TITLE   = dark_colors.blue;
    PKT_COLOR_START_TITLE  = dark_colors.yellow;
    PKT_COLOR_HUM_TITLE    = dark_colors.violet;
    PKT_COLOR_TEMP_TITLE   = dark_colors.orange;
    PKT_COLOR_CHECK_TITLE  = dark_colors.red;

    if (sensor == 0)
    {
        DHTxx = DHT11;
    }
    else
    {
        DHTxx = DHT22;
    }

    pkt_start("DHTxx");

    t = trs_get_first(ch);          // Get the first transition
    t = get_preamble_data(ch, t);   // Deal with the initial negotiations

    var startPos = [];              // Save the start position of each byte
    var endPos = [];                // Save the end position of each byte
    var bit = 0;                    // Bit counter
    var bytes = 0;
    var start = t.sample;           // Save the initial start position of each byte
    var myArray = [];               // Array to hold the 40 bits of data
    var i = 0;                      // count the data bits in main while loop

    while (trs_is_not_last(ch))
    {	
	    if (abort_requested() == true)	// Allow the user to abort this script
		{
			return false;
		}
	
        // 16 bits as we have 1 start bit for every data bit
        // Place the start and end position in the arrays
        // The current t.sample is the end of this byte and the start of the next
        // probably more correct to have start = t.sample+1 but this is ok

        if (bit >= 16)  
        {
            startPos[bytes] = start;
            endPos[bytes] = t.sample;
            bytes++;
            bit = 0;
            start = t.sample;
        }

        // if the last transition was low to high we are looking for data
        // on a rising edge 70us is a 1 & 20-28us is a 0
        // Found the actual values are not as exact as the data sheet
        // Also if >21 and the measured value is 21.999 it seems to
        // interpreted as 21 so you need >20

        if (t.val == 1) 
        {
            trStart = t.sample;
            t = get_next_falling_edge(ch, t);
            next = t.sample;    
            tranLen = tr_len_us((next - trStart));

            // put a 1 in the array and display it, also add as comment so that
            // if mouse over shows the bit value

            if ((tranLen > DHTxx.BIT_ONE_MIN) && (tranLen < DHTxx.BIT_ONE_MAX))
            {
                myArray[i] = 0x01; 
                i++;
            }

            // put a 0 in the array and display it, also add as comment so that
            // if mouse over shows the bit value

            if ((tranLen > DHTxx.BIT_ZERO_MIN) && (tranLen < DHTxx.BIT_ZERO_MAX))
            {
                myArray[i] = 0x00;
                i++;
            }
        }

        // else we should have a start bit, note the last low is a stop bit
        // That should be the the same length as a start bit, but on my
        // device is not in tolerance, more accurate would be to change the
        // while loop to count the 40 data bits then deal with the last transition
        // This decoder just ignores it, but it is possible it will display as
        // a start bit depending on device tolerance 
        else
        {
            trStart = t.sample;
            t = get_next_rising_edge(ch, t);
            next = t.sample;    
            tranLen = tr_len_us((next - trStart));
        }
            
        bit++;
    }

    var myByte = [];    // Split the array into an array of five bytes
    var myBit = 0;      // individual bits
    var val = 0;        // holds the value of the byte
    var inx = 0;        // index for the byte count 
    var count = 0;      // 40 bits in the data stream, need to keep a count
                        // myByte[0] = relative humidity
                        // myByte[2] = temperature
                        // myByte[4] = checksum which is just the sum of RH + Temp
                        // myByte [1] & [3] always read 0
    while (inx <= 4)
    {
        var bit = 0;

        while (bit <= 7)
        {
            myBit = myArray[count];
            val = (val * 2) + myBit;
            bit++;
            count++;
        }

        myByte[inx] = val;
        inx++;
        val = 0;
        myBit = 0;
    }

    var hum;
    var temp;

    if (DHTxx.DEVICE == "DHT11")
    {
        hum = myByte[0];
        temp = myByte[2];
    }
    else if (DHTxx.DEVICE == "DHT22")
    {
        hum = ((myByte[0] * 256 + myByte[1]) / 10);
        temp = ((myByte[2] * 256 + myByte[3]) / 10);
    }

    // place bytes along channel at correct position

    dec_item_new(ch, startPos[0], endPos[1]);
    dec_item_add_pre_text("HUMIDITY: " + hum + "%");
    dec_item_add_pre_text(hum + "%");

    pkt_add_item(-1, -1, "HUMIDITY", hum + "%", PKT_COLOR_HUM_TITLE, PKT_COLOR_DATA, true);
    hex_add_byte(ch, -1, -1, hum);

    dec_item_new(ch, startPos[2], endPos[3]);
    dec_item_add_pre_text("TEMP: " + get_formatted_temp(temp));
    dec_item_add_pre_text(get_formatted_temp(temp));

    pkt_add_item(-1, -1, "TEMPERATURE", get_formatted_temp(temp), PKT_COLOR_TEMP_TITLE, PKT_COLOR_DATA, true);
    hex_add_byte(ch, -1, -1, temp);

    var checksum = myByte[0] + myByte[2];
    var chekResult = "(ERROR)"

    if (checksum == myByte[4])
    {
        chekResult = "(OK)"
    }

    dec_item_new(ch, startPos[4], endPos[4]);
    dec_item_add_pre_text("CHECKSUM: ");
    dec_item_add_data(myByte[4]);
    dec_item_add_post_text(" " + chekResult);

    pkt_add_item(-1, -1, "CHECKSUM", "0x" + myByte[4].toString(16).toUpperCase() + chekResult, PKT_COLOR_CHECK_TITLE, PKT_COLOR_DATA, true);
    hex_add_byte(ch, -1, -1, myByte[4]);
    pkt_end();
}


/* Function to get the initial negotiation with DHTxx before data TX by DHTxx   
   The MCU goes low for 500us followed by a 20 - 40us high
   after which the DHTxx should go low 80us high 80us to indicate start of data
   transmission my DHTxx does not seem very accurate with this, so just assuming
   that if the first part of the preamble is correct the next two transitions
   are indicating start of TX
*/
function get_preamble_data (ch, t)
{
    var trStart = 0;
    var next = 0;

    t = get_next_falling_edge(ch, t);  // Falling edge is start of data
    trStart = t.sample;

    t = get_next_rising_edge(ch, t);
    next = t.sample;

    tranLen = tr_len_us((next - trStart));

    if (tranLen > DHTxx.START)
    {
        dec_item_new(ch, trStart, next);
        dec_item_add_pre_text("WAKE UP PULSE (" + tranLen + " us)");
        dec_item_add_pre_text("WAKE UP");

        pkt_add_item(-1, -1, "WAKE UP", "", PKT_COLOR_WAKEUP_TITLE, PKT_COLOR_DATA, true);

        trStart = t.sample;
        t = get_next_falling_edge(ch, t);
        next = t.sample;
        tranLen = tr_len_us((next - trStart));

        if ((tranLen > DHTxx.WAIT_REPLY_MIN) && (tranLen < DHTxx.WAIT_REPLY_MAX)) 
        {
            dec_item_new(ch, trStart, next);
            dec_item_add_pre_text("WAIT (" + tranLen + " us)");
            dec_item_add_pre_text("WAIT");

            pkt_add_item(-1, -1, "WAIT", "", PKT_COLOR_WAIT_TITLE, PKT_COLOR_DATA, true);
        }
    }

    trStart = t.sample;
    t = get_next_rising_edge(ch, t);
    t = get_next_falling_edge(ch, t);

    next = t.sample;
    tranLen = tr_len_us((next - trStart));

    dec_item_new(ch, trStart, next);
    dec_item_add_post_text("START TX (" + tranLen + " us)");
    dec_item_add_post_text("TX");

    pkt_add_item(-1, -1, "START TX", "", PKT_COLOR_START_TITLE, PKT_COLOR_DATA, true);

    return t;  // Return t so the main loop can start from next transition
}


/* Temp conversion
*/
function get_formatted_temp (temp)
{
    var tempStr;
    var sign = "+";

    switch (tempUnit)
    {
        case 0: if (temp == 0)
                {
                    sign = "";
                }

                tempStr = sign + temp + "°C";
                break;

        case 1: var fahTemp = ((temp * (9 / 5)) + 32);

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


/*  Get number of samples for the specified duration in microseconds
    round off to 3 decimal places minimum pulse is 20us 
*/
function tr_len_us (us)
{   
    us  = ((us * 1000000) / sample_rate);
    return us = Math.round(us * 1000) / 1000;
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


/* Get next transition with falling edge
*/
function get_next_falling_edge (ch, trStart)
{
    var tr = trStart;
    
    while ((tr.val != FALLING) && (trs_is_not_last(ch) == true))
    {
        tr = trs_get_next(ch);  // Get the next transition
    }

    if (trs_is_not_last(ch) == false) tr = false;

    return tr;
}


/*  Get next transition with rising edge
*/
function get_next_rising_edge (ch, trStart)
{
    var tr = trStart;
    
    while ((tr.val != RISING) && (trs_is_not_last(ch) == true))
    {
        tr = trs_get_next(ch);  // Get the next transition
    }

    if (trs_is_not_last(ch) == false) tr = false;

    return tr;
}
