/*
*************************************************************************************

							SCANASTUDIO 2 DECODER

The following commented block allows some related informations to be displayed online

<DESCRIPTION>
	Single Edge Nibble Transmission (SENT) decoder according to SAE2716 Jan 2010.
	Copyright 2014 Volker Oth
	Licensed under the Creative Commons Attribution 4.0 license
	http://creativecommons.org/licenses/by/4.0/
	Software is distributed on an "AS IS" BASIS, WITHOUT
	WARRANTIES OF ANY KIND, either express or implied.
</DESCRIPTION>

<RELEASE_NOTES>
	V1.0:  Initial release
</RELEASE_NOTES>

<AUTHOR_URL>
	mailto:VolkerOth(at)gmx.de
</AUTHOR_URL>

<HELP_URL>

</HELP_URL>

*************************************************************************************
*/

/* The decoder name as it will appear to the users of this script */
function get_dec_name() {
	return "SENT";
}

/* The decoder version */
function get_dec_ver() {
	return "1.0";
}

/* The decoder's author */
function get_dec_auth() {
	return "Volker Oth [0xdeadbeef]";
}

var activeEdge = 0;     // Falling edge is active edge (as defined in the SAE J2716)

var CRC4_INIT = 5;

var CRC6_INIT = 0x15;
var CRC6_POLY = 0x59;

var crc4Table = [0,13,7,10,14,3,9,4,1,12,6,11,15,2,8,5];

var crc6Table = [ 0,25,50,43,61,36,15,22,35,58,17, 8,30, 7,44,53,
                 31, 6,45,52,34,59,16, 9,60,37,14,23, 1,24,51,42,
                 62,39,12,21, 3,26,49,40,29, 4,47,54,32,57,18,11,
                 33,56,19,10,28, 5,46,55, 2,27,48,41,63,38,13,20 ];

var ppTicks = 769;      // Number of SENT ticks allowed for a pause pulse (SAE J2716 defines 768, +1 to be more relaxed)

var states = {
	SYNC_ST:         0, // Synchronization: search for valid CAL pulse
	DECODE_ST:       1, // Normal operation
	RESYNC_ST:       2  // Resynchronize after fault
};

var strFault = ["OK", "Too few", "Too many", "Too long", "Clock shift", "Too small", "Too large", "CRC" ];

var faults = {
	OK:              0,  // No fault
	TOO_FEW_PULSES:  1,  // Too few pulses before CAL
	TOO_MANY_PULSES: 2,  // No CAL pulse found at expected position
	PULSE_TOO_LONG:  3,  // Pulse longer than CAL detected
	CLOCK_SHIFT:     4,  // Transmitter clock changed > +/- 1.56% (1/64)
	DATA_TOO_SMALL:  5,  // Nibble value < 0
	DATA_TOO_LARGE:  6,  // Nibble value > 15
	CRC_ERROR:       7   // Calculated message CRC doesn't match received CTC
};

var serialStates = {
	SYNC_ST:         0,  // Synchronization state: search for start bit
	DECODE_ST:       1,  // Normal operation
	PATTERN_ST:      2,  // Pattern state: search enhanced start pattern
	SYNCED_ST:       3   // Skip to Pattern state after re-init
};

var serialBits = {
	DATA_BIT:        4,  // Bit2 of status & communication nibble is the serial data bit
	START_BIT:       8   // Bit3 of status & communication nibble is the serial start bit
};

var strSerialFault = ["OK", "Too few", "CRC", "Frame Bit" ];

var serialFaults = {
	OK:              0,  // No fault
	TOO_FEW_BITS:    1,  // All messages valid, but not enough messages between start bits
	CRC_ERROR:       2,  // CRC Error: calculated serial data CRC failed
	FRAME_BIT_ERROR: 3   // A one was received at a position were a fixed zero was expected
};

var strData = ["HI", "MED", "LO"];

var serialOpen = 0;

function serialPkt() {
	if (serialOpen === 0) {
		pkt_start("Serial");
		serialOpen = 1;
	}
}

/* Graphical user interface for this decoder */
function gui() { //graphical user interface
	ui_clear();  // clean up the User interface before drawing a new one.
	ui_add_info_label( "Single Edge Nibble Transmission" );
	ui_add_ch_selector( "ch", "Channel to decode:", "" );
	ui_add_num_combo( "dataSize", "Number of data nibbles", 1, 6, 6);
	ui_add_num_combo( "tickPer", "Tick period (탎)", 2, 100, 3);
	ui_add_num_combo( "tickTol", "Tick tolerance (%)", 0, 20, 5);
	ui_add_txt_combo( "crcMode", "CRC Mode" );
		ui_add_item_to_txt_combo( "Legacy", true );
		ui_add_item_to_txt_combo( "Recommended" );
	ui_add_txt_combo( "pausePulse", "Pause Pulse" );
		ui_add_item_to_txt_combo( "Off", true );
		ui_add_item_to_txt_combo( "On" );
	ui_add_txt_combo( "serialMode", "Serial Decoding" );
		ui_add_item_to_txt_combo( "Off", true );
		ui_add_item_to_txt_combo( "Short Message" );
		ui_add_item_to_txt_combo( "Enhanced Message" );
}

/* Convert a nibble to hex */
function hex_nibble (num)  {
	return "0x"+ num.toString(16).toUpperCase();
}

function get_ch_light_color (k) {
    var colChannel = get_ch_color(k);

	colChannel.r = (colChannel.r * 1 + 255 * 3) / 4;
	colChannel.g = (colChannel.g * 1 + 255 * 3) / 4;
	colChannel.b = (colChannel.b * 1 + 255 * 3) / 4;

	return colChannel;
}


/* This is the function that will be called from ScanaStudio to update the decoded items */
function decode() {
	get_ui_vals();
	clear_dec_items();
	
	var colCal = dark_colors.blue;
	var colStart = dark_colors.blue;
	var colStatus  = dark_colors.green;
	var colData = dark_colors.gray;
	var colCrc  = dark_colors.orange;
	var colFault  = dark_colors.red;

	var crc;								// calculated message CRC (updated with each nibble)
	var crcRx;								// received message CRC
	var state = states.SYNC_ST;				// message deoding state: start searching for sync
	var serialState = serialStates.SYNC_ST;	// serial decoding state: start searching for sync
	var pauseTmp = pausePulse;				// temporary enable bit for pause pulse
	var serialNibble;						// value currently decoded (data) nibble
	var serialNibbleID;						// value currently decoded ID nibble in enhanced mode
	var statusNibble = -1;					// value of status nibble that contains the serial information
	var calStart;							// sample where the last CAL pulse started
	var serialNibbleStart;					// sample where the last serial data nibble started
	var serialNibbleIDStart;				// sample where the last serial ID nibble started in enhanced mode
	var serialCtr = 0;						// counter for serial messages
	var serialCrc;							// calculated serial message CRC (updated during receiving)
	var serialCrcRx;						// receiver serial CRC
	var pulseCtr = 0;						// message pulse counter
	var serialBit2;							// value of bit 2 (inside status bit) in enhanced serial mode
	var serialBit3;							// value of bit 3 (inside status bit) in enhanced serial mode
	var msgPktOpen = 0;						// flag to show if the packet for a message is currently open
	var crcPos;								// index of CRC in message (might shift due to pause pulse)
	var calPeriod;							// length of last CAL pulse in internal samples
	var tickPeriod;							// length of SENT time tick (e.g. 3탎) in internal samples
	var maxPausePulse;                      // maximum pause pulse length (768 SENT ticks)
	
	var edge = trs_get_first(ch);           // get very first edge
	if (edge.val != activeEdge)				// skip if it's not an active edge
		edge = trs_get_next(ch);
	var colChannel = get_ch_light_color(ch);

	tickPer  += 2; 							// combobox index, not the value at the index
	dataSize += 3; 							// combobox the index, not the value at the index, +2 for SC and CRC nibbles
	crcPos = dataSize;
	if (pausePulse!==0)
		dataSize++;
	
	// calculate min/max CAL size from given tick period and allowed deviation
	calPeriod = 56*tickPer*sample_rate/1000000;
	maxPausePulse = ppTicks*tickPer*sample_rate/1000000;
	var minCalTicks = calPeriod * (1-tickTol/100); 
	var maxCalTicks = calPeriod * (1+tickTol/100); 

	while ((trs_is_not_last(ch) !== false)) {
		if (abort_requested() === true)
			return;

		set_progress(100 * edge.sample / n_samples);

		var edgePrev = edge;
		edge = trs_get_next(ch); // skip the passive edge
		edge = trs_get_next(ch);

		var storeCal = 0;
		var nibble = -1;
		var period = edge.sample - edgePrev.sample; // period between active edges
		var fault = faults.OK;
		var serialFault = serialFaults.OK;
		
		if (state == states.SYNC_ST) {
			nibble = -1;
			// Synchronization State
			if (period <= maxCalTicks) {
				if (period >= minCalTicks) {
					// Either a pause pulse (CAL will be next) or CAL pulse
					pauseTmp = 2; // possible pause pulse
					pulseCtr = 0;
					state = states.DECODE_ST;
					storeCal = 1;
				} else {
					// Continue searching for CAL
					if (pulseCtr == dataSize) {
						fault = faults.TOO_MANY_PULSES;
						state = states.RESYNC_ST;
					} else
						pulseCtr++;
				} 
			} else {
				// This could be pause pulse
				if (pauseTmp === 0 || (period > maxPausePulse)) {
					// timeout
					fault = faults.PULSE_TOO_LONG;
					state = states.RESYNC_ST;
				} else
					pauseTmp = 0; // forbid another pause pulse
			}
		} else {
			// Decode State
			if (period > maxPausePulse) {
				// timeout
				fault = faults.PULSE_TOO_LONG;
				state = states.RESYNC_ST;
			} else if ((pauseTmp != 1) && (period >= minCalTicks) && (period <= maxCalTicks)) {
				// CAL pulse
				storeCal = 1;
				if (pulseCtr == dataSize) {
					// check clock shift
					if (Math.abs(period-calPeriod)*64 > calPeriod)
						fault = faults.CLOCK_SHIFT;
					else {
						// message was received -> serial decoding
						if (serialMode == 1) {
							// short message format
							if ((statusNibble & serialBits.START_BIT) !== 0) {
								// start bit detected
								if (serialState == serialStates.DECODE_ST)
									serialFault = serialFaults.TOO_FEW_BITS;
								serialCtr = 0;
								serialState = serialStates.DECODE_ST;
								serialPkt();
								pkt_add_item(calStart,edgePrev.sample,"START","Short",colStart, colChannel);
								serialNibbleStart = calStart;
								// Init CRC
								serialCrc = CRC4_INIT;
								serialNibble = ((statusNibble & serialBits.DATA_BIT) !== 0) ? 1 : 0;
							} else if (serialState == serialStates.DECODE_ST) {
								serialNibble <<= 1;
								serialNibble |= ((statusNibble & serialBits.DATA_BIT) !== 0) ? 1 : 0;
								serialCtr++;
								if ((serialCtr == 3) || (serialCtr == 7) || (serialCtr == 11)) {
									serialCrc = crc4Table[serialCrc] ^ serialNibble;
									serialPkt();
									pkt_add_item(serialNibbleStart,edgePrev.sample,"DATA "+(((serialCtr+1)/4)-1),hex_nibble(serialNibble),colData, colChannel);
									serialNibbleStart = edgePrev.sample;
									serialNibble = 0;
								} else if (serialCtr == 15) {
									serialState = serialStates.SYNC_ST;
									// check CRC
									if (crcMode !== 0) 
										serialCrc = crc4Table[serialCrc];
									if ((serialCrc & 0xf) != (serialNibble & 0x0f))
										serialFault = serialFaults.CRC_ERROR;
									else {
										// message decoded
										serialPkt();
										pkt_add_item(serialNibbleStart,edgePrev.sample,"CRC",hex_nibble(serialNibble),colCrc, colChannel);
									}
								}
							}
							if (serialFault != serialFaults.OK) {
								serialPkt();
								pkt_add_item(serialNibbleStart,edgePrev.sample, "Fault", strSerialFault[serialFault], colFault, colChannel);
							}
							if (serialOpen !== 0) {
								serialOpen = 0;
								pkt_end();
							}
						} else if (serialMode == 2) {
							// enhanced message format
							serialBit3 = (statusNibble >> 3) & 1;
							if (serialState == serialStates.SYNC_ST) {
								if (serialBit3 === 0) 
									serialState = serialStates.SYNCED_ST; // look for start pattern
							} else {
								if (serialState == serialStates.SYNCED_ST) {
									serialCtr = 0;
									serialState = serialStates.PATTERN_ST;
									serialNibble = 0;
									serialNibbleID = 0;
									serialCrc = CRC6_INIT;
									if (serialBit3 !== 0) {
										serialPkt();
										pkt_add_item(calStart,edgePrev.sample,"START","Enhanced",colStart, colChannel);
									}
									serialNibbleStart = calStart;
								}
								serialBit2 = (statusNibble >> 2) & 1;
								serialNibble <<= 1;
								serialNibble |= serialBit2;
								if (++serialCtr < 7) {
									if (serialBit3 !== 0) {
										if (serialCtr == 6) {
											serialCrcRx = serialNibble;
											serialNibble = 0;
											serialPkt();
											pkt_add_item(serialNibbleStart,edgePrev.sample,"CRC",hex_nibble(serialCrcRx),colCrc, colChannel);
										}
									} else 
										serialState = serialStates.SYNCED_ST; // look for start pattern
								} else {
									// update crc
									serialCrc <<= 1;
									if ((serialCrc & 64) !== 0)
										serialCrc ^= CRC6_POLY;
									serialCrc ^= serialBit2;
									serialCrc <<= 1;
									if ((serialCrc & 64) !== 0)
										serialCrc ^= CRC6_POLY;
									serialCrc ^= serialBit3;
									// handling of different bits
									switch (serialCtr) {
										case 7:
										case 13:
										case 18:
											// check zero bits
											if (serialBit3 === 0) {
												if (serialCtr == 18) {
													// message received
													serialState = serialStates.SYNCED_ST;
													serialCrc = crc6Table[serialCrc]; // add 6 zero bits to CRC
													if (serialCrcRx != serialCrc) 
														serialFault = serialFaults.CRC_ERROR;
												} else
													serialState = serialStates.DECODE_ST;
											} else {
												serialState = serialStates.SYNC_ST;
												serialFault = serialFaults.FRAME_BIT_ERROR;
											}
											break;
										case 8:
											// configuration bit - not used
											break;
										default:
											// update ID
											serialNibbleID <<= 1;
											serialNibbleID |= serialBit3;
											break;
									}
									// packet output
									switch (serialCtr) {
										case 7:
										case 11:
										case 15:
											serialNibbleStart = calStart;
											break;
										case 9:
											serialNibbleIDStart = calStart;
											break;
										case 12:
										case 17:
											serialPkt();
											pkt_add_item(serialNibbleIDStart,edge.sample,"ID_"+((serialCtr==12)?"HI":"LO"),hex_nibble(serialNibbleID),colData, colChannel);
											serialNibbleID = 0;
											break;
										case 14:
											serialNibbleIDStart = calStart;
											///fallthrough
										case 10:
										case 18:
											serialPkt();
											pkt_add_item(serialNibbleStart,edge.sample,"DATA_"+strData[(serialCtr-10)/4],hex_nibble(serialNibble),colData, colChannel);
											serialNibble = 0;
											break;
									}
								}
							}
							if (serialFault != serialFaults.OK) {
								serialPkt();
								pkt_add_item(serialNibbleStart,edgePrev.sample, "Fault", strSerialFault[serialFault], colFault, colChannel);
							}
							if (serialOpen !== 0) {
								serialOpen = 0;
								pkt_end();
							}
						}
					}
				} else {
					if (pauseTmp != 2) {
						fault = faults.TOO_FEW_PULSES; // CAL or pause pulse before all bits received
						pauseTmp = 2; // could be a pause pulse
					} else
						pauseTmp = 0; // CAL pulse after pause pulse
				}
				pulseCtr = 0;
			} else {
				// normal pulse (or pause pulse)
				pauseTmp = 0;
				if (pulseCtr == dataSize) {
					fault = faults.TOO_MANY_PULSES; // CAL or pause pulse before all bits received
					state = states.RESYNC_ST;
				} else {
					pulseCtr++;
					// decode nibble
					nibble = Math.round(period / tickPeriod);
					if (nibble < 12) {
						fault = faults.DATA_TOO_SMALL;
						state = states.RESYNC_ST;
					} else if ((pausePulse === 0) || (pulseCtr < dataSize)) {
						if (nibble > 27) {
							if (period > maxCalTicks)
								fault = faults.PULSE_TOO_LONG; // Longer than a CAL pulse 
							else
								fault = faults.DATA_TOO_LARGE; // Shorter than a CAL pulse, but too long for a nibble
							state = states.RESYNC_ST;
						} else {
							// store nibble
							nibble -= 12;
							if (pulseCtr == 1) {
								statusNibble = nibble;
								crc = CRC4_INIT;
							} else {
								var tmp = crc4Table[crc];
								if (pulseCtr == crcPos) {
									pauseTmp = 1;  // expect pause pulse next (if enabled)
									crcRx = nibble;
									if (crcMode !== 0)
										crc = tmp;
									if (crc != crcRx)
										fault = faults.CRC_ERROR;
								} else
									crc = tmp ^ nibble;
							}
						}
					}
				}
			}
		}
		perMicroSec = period*1000000/sample_rate;
		// Display CAL
		if (storeCal !== 0) {
			calPeriod = period;
			tickPeriod = Math.round(calPeriod / 56);
			maxPausePulse = Math.round(calPeriod * ppTicks / 56);
			calStart = edgePrev.sample;
			dec_item_new(ch,edgePrev.sample, edge.sample);
			dec_item_add_pre_text("Calibration Pulse ");
			dec_item_add_pre_text("CAL");
			dec_item_add_pre_text("C");
			dec_item_add_comment("Calibration Pulse ["+perMicroSec.toFixed(3)+"탎]");
		}
		// Display nibbles
		if ((storeCal === 0) && (nibble != -1)) {
			dec_item_new(ch,edgePrev.sample, edge.sample);
			if (pulseCtr==1) {
				dec_item_add_data(nibble);
				dec_item_add_pre_text("Status&Comm ");
				dec_item_add_pre_text("SC ");
				dec_item_add_pre_text("S ");
				dec_item_add_comment("Status and Communication Nibble ["+perMicroSec.toFixed(3)+"탎]");
				pkt_add_item(edgePrev.sample,edge.sample, "Status", hex_nibble(nibble), colStatus, colChannel);
			} else if (pulseCtr==crcPos) {
				dec_item_add_data(nibble);
				dec_item_add_pre_text("CRC ");
				dec_item_add_pre_text("C ");
				dec_item_add_comment("Checksum Nibble ["+perMicroSec.toFixed(3)+"탎]");
				pkt_add_item(edgePrev.sample,edge.sample, "CRC", hex_nibble(nibble), colCrc, colChannel);
			} else if ((pausePulse!==0) && (pulseCtr==dataSize)) {
				dec_item_add_pre_text("Pause Pulse");
				dec_item_add_pre_text("Pause ");
				dec_item_add_pre_text("P ");
				dec_item_add_comment("Pause Pulse ["+perMicroSec.toFixed(3)+"탎]");
			} else {
				dec_item_add_data(nibble);
				dec_item_add_comment("Data Nibble "+(pulseCtr-2)+" ["+perMicroSec.toFixed(3)+"탎]");
				pkt_add_item(edgePrev.sample,edge.sample, "DATA "+(pulseCtr-2), hex_nibble(nibble), colData, colChannel);
			}
		}
		// Display faults
		if (fault != faults.OK) {
			dec_item_new(ch,edgePrev.sample, edge.sample);
			if (fault == faults.CRC_ERROR)
				dec_item_add_comment("Fault: " + strFault[fault]+" ("+hex_nibble(crcRx)+"!="+hex_nibble(crc)+") ["+perMicroSec.toFixed(3)+"탎]");
			else 
				dec_item_add_comment("Fault: " + strFault[fault]+" ["+perMicroSec.toFixed(3)+"탎]");
			dec_item_add_pre_text("Fault");
			dec_item_add_pre_text("F");
			if (msgPktOpen === 0) 
				pkt_start("FAULT");
			pkt_add_item(edgePrev.sample, edge.sample, "Fault", strFault[fault], colFault, colChannel);
			if (serialState == serialStates.DECODE_ST) {
				pkt_start("Serial");
				pkt_add_item(serialNibbleStart,edgePrev.sample, "Fault", strSerialFault[serialFaults.TOO_FEW_BITS], colFault, colChannel);
				pkt_end();
			}
			serialState = serialStates.SYNC_ST;
			if (msgPktOpen === 0)
				pkt_end();
		}
		// Add CAL to packet view
		if (storeCal !== 0) {
			if (msgPktOpen !== 0)
				pkt_end();
			msgPktOpen = 1;
			pkt_start("SENT");
			pkt_add_item(edgePrev.sample,edge.sample,"CAL",""+perMicroSec.toFixed(2)+"us",colCal, colChannel);
		}
		if (state == states.RESYNC_ST) {
			pulseCtr = 0;
			state = states.SYNC_ST;
			pauseTmp = 1;
		}
		if (pausePulse === 0) // if pause pulse is disabled, ignore temporary expectations
			pauseTmp = 0;
	}
	// Close open packet
	if (msgPktOpen !== 0)
		pkt_end();
}
