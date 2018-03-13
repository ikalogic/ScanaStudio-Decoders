/*
*************************************************************************************

							SCANASTUDIO 2 DECODER

The following commented block allows some related informations to be displayed online

<DESCRIPTION>

	MIDI (Musical Instrument Digital Interface) Protocol Decoder.

</DESCRIPTION>

<RELEASE_NOTES>

	V1.11: Now the decoding can be aborted
	V1.1:  Added to supplementary status information, and enhanced packet view.
	V1.0:  Initial release

</RELEASE_NOTES>

<AUTHOR_URL>

	mailto:i.kamal@ikalogic.com

</AUTHOR_URL>

*************************************************************************************
*/

/* The decoder name as it will apear to the users of this script 
*/
function get_dec_name()
{
	return "MIDI";
}

/* The decoder version 
*/
function get_dec_ver()
{
	return "1.11";
}

/* Author 
*/
function get_dec_auth()
{
	return "IKALOGIC";
}

/* Graphical user interface for this decoder 
*/
function gui()
{
	ui_clear();  // clean up the User interface before drawing a new one.
	ui_add_ch_selector( "ch", "Channel to decode", "MIDI" );
}

/* Global variables
*/
var Note_On 	     = 0x80;
var Note_Off 		 = 0x90;
var Aftertouch 		 = 0xA0;
var Control_Change   = 0xB0;
var Program_Change   = 0xC0;
var Channel_Pressure = 0xD0;
var Pitch_Wheel      = 0xE0;
var SysEx_Start      = 0xF0;
var Song_Position    = 0xF2;
var Song_Select      = 0xF3;
var Tuning 		     = 0xF6;
var SysEx_Stop 		 = 0xF7;
var Tempo 			 = 0xF8;
var Start_MIDI 		 = 0xFA;
var Continue_MIDI    = 0xFB;
var Stop_MIDI        = 0xFC;
var Active_Sensing   = 0xFE;
var Reset 		     = 0xFF;
var Nothing_Status   = 0x00;

var PKT_COLOR_DATA; 
var PKT_COLOR_DATA_TITLE ;

var PKT_COLOR_START_TITLE ;			
var PKT_COLOR_STOP_TITLE;
var PKT_COLOR_MANUFACTURER_TITLE;	
var PKT_COLOR_RESET;
var PKT_COLOR_SONG_POS_TITLE;		
var PKT_COLOR_SONG_SELECT_TITLE;
var PKT_COLOR_TUNING;				
var PKT_COLOR_TEMPO;
var PKT_COLOR_MIDI_START;			
var PKT_COLOR_MIDI_STOP;
var PKT_COLOR_CONTINUE;				
var PKT_COLOR_ACTIVE_SENS;

var PKT_COLOR_NOTE_ON_TITLE;		
var PKT_COLOR_NOTE_OFF_TITLE;
var PKT_COLOR_AFTERTOUCH_TITLE;		
var PKT_COLOR_CONTROL_CHANGE_TITLE;
var PKT_COLOR_PROGRAM_CHANGE_TITLE; 
var PKT_COLOR_CHANNEL_PRESSURE_TITLE;
var PKT_COLOR_PITCH_WHEEL_TITLE;	
var PKT_COLOR_CHANNEL_TITLE;

var strHexData;
var state_voice = Nothing_Status;
var state_system = Nothing_Status
var ID_2byte = false;
var id_1s_byte_start_sample = 0;
var byte_1 = 0xFF;

var tab_note = ["C-5 ", "C#-5 ", "D-5 ", "D#-5 ", "E-5 ", "F-5 ", "F#-5 ", "G-5 ", "G#-5 ", "A-5 ", "A#-5 ", "B-5 ", 
				"C-4 ", "C#-4 ", "D-4 ", "D#-4 ", "E-4 ", "F-4 ", "F#-4 ", "G-4 ", "G#-4 ", "A-4 ", "A#-4 ", "B-4 ",
				"C-3 ", "C#-3 ", "D-3 ", "D#-3 ", "E-3 ", "F-3 ", "F#-3 ", "G-3 ", "G#-3 ", "A-3 ", "A#-3 ", "B-3 ",
				"C-2 ", "C#-2 ", "D-2 ", "D#-2 ", "E-2 ", "F-2 ", "F#-2 ", "G-2 ", "G#-2 ", "A-2 ", "A#-2 ", "B-2 ",
				"C-1 ", "C#-1 ", "D-1 ", "D#-1 ", "E-1 ", "F-1 ", "F#-1 ", "G-1 ", "G#-1 ", "A-1 ", "A#-1 ", "B-1 ",
				"C0 ", "C#0 ", "D0 ", "D#0 ", "E0 ", "F0 ", "F#0 ", "G0 ", "G#0 ", "A0 ", "A#0 ", "B0 ",
				"C1 ", "C#1 ", "D1 ", "D#1 ", "E1 ", "F1 ", "F#1 ", "G1 ", "G#1 ", "A1 ", "A#1 ", "B1 ",
				"C2 ", "C#2 ", "D2 ", "D#2 ", "E2 ", "F2 ", "F#2 ", "G2 ", "G#2 ", "A2 ", "A#2 ", "B2 ",
				"C3 ", "C#3 ", "D3 ", "D#3 ", "E3 ", "F3 ", "F#3 ", "G3 ", "G#3 ", "A3 ", "A#3 ", "B3 ",
				"C4 ", "C#4 ", "D4 ", "D#4 ", "E4 ", "F4 ", "F#4 ", "G4 ", "G#4 ", "A4 ", "A#4 ", "B4 ",
				"C5 ", "C#5 ", "D5 ", "D#5 ", "E5 ", "F5 ", "F#5 ", "G5 "];

var tab_program_instrument = ["Acoustic Grand", "Bright Acoustic", "Electric Grand", "Honky-Tonk", "Electric Piano 1", "Electric Piano 2", 
								"Harpsichord", "Clavinet", "Celesta", "Glockenspiel", "Music Box", "Vibraphone", "Marimba", "Xylophone", 
								"Tubular Bells", "Dulcimer", "Drawbar Organ", "Percussive Organ", "Rock Organ", "Church Organ", "Reed Organ", 
								"Accordian", "Harmonica", "Tango Accordian", "Nylon String Guitar", "Steel String Guitar", "Electric Jazz Guitar",
								"Electric Clean Guitar", "Electric Muted Guitar", "Overdriven Guitar", "Distortion Guitar", "Guitar Harmonics", 
								"Acoustic Bass", "Electric Bass (finger)", "Electric Bass (pick)", "Fretless Bass", "Slap Bass 1", "Slap Bass 2", 
								"Synth Bass 1", "Synth Bas 2", "Violin", "Viola", "Cello", "Contrabass", "Tremolo Strings", "Pizzicato Strings", 
								"Orchestral Strings", "Timpani", "String Ensemble 1", "String Ensemble 2", "SynthStrings 1", "SynthStrings 2", 
								"Choir Aahs", "Voice Oohs", "Synth Voice", "Orchestra Hit", "Trumpet", "Trombone", "Tuba", "Multed Trumpet", 
								"French Horn", "Brass Section", "SynthBrass 1", "SynthBrass 2", "Soprano Sax", "Alto Sax", "Tenor Sax",
								"Baritone Sax", "Oboe", "English Horn", "Basson", "Clarinet", "Piccolo", "Flute", "Recorder", "Pan Flute", 
								"Blown Bottle", "Skakuhachi", "Whistle", "Ocarina", "Lead 1 (square)", "Lead 2 (sawtooth)", "Lead 3 (calliope)", 
								"Lead 4 (chiff)", "Lead 5 (charang)", "Lead 6 (voice)", "Lead 7 (fifths)", "Lead 8 (bass+lead)", "Pad 1 (new age)", 
								"Pad 2 (warm)", "Pad 3 (polysynth)", "Pad 4 (choir)", "Pad 5 (bowed)", "Pad 6 (metallic)", "Pad 7 (halo)", 
								"Pad 8 (sweep)", "FX 1 (rain)", "FX 2 (soundtrack)", "FX 3 (crystal)", "FX 4 (atmosphere)", "FX 5 (brightness)", 
								"FX 6 (goblins)", "FX 7 (echoes)", "FX 8 (sci-fi)", "Sitar", "Banjo", "Shamisen", "Koto", "Kalimba", "Bagpipe", 
								"Fiddle", "Shanai", "Tinkle Bell", "Agogo", "Steel Drums", "Woodblock", "Taiko Drum", "Melodic Tom", "Synth Drum", 
								"Reverse Cymbal", "Guitar Fret Noise", "Breath Noise", "Seashore", "Bird Tweet", "Telephone Ring", "Helicopter", 
								"Applause", "Gunshot"];

var tab_program_group = ["Piano", "Chromatic Percussion", "Organ", "Guitar", "Bass", "Salo Strings", "Ensemble", "Brass", "Reed", "Pipe", 
						 "Synth Lead", "Synth PAD", "Synth Effects", "Ethnic", "Percussive", "Sound Effects"];
					
var tab_controllers = ["Bank Slect (coarse)", "Modulation Wheel (coarse)", "Breath controller (coarse)", "undefined", 
						"Foot Pedal (coarse)", "Portamento Time (coarse)", "Data Entry (coarse)", "Volume (coarse)", "Balance (coarse)", 
						"undefined", "Pan position (coarse)", "Expression (coarse)", "Effect Control 1 (coarse)", 
						"Effect Control 2 (coarse)", "undefined", "undefined", "General Purpose Slidr 1", 
						"General Purpose Slidr 2", "General Purpose Slidr 3", "General Purpose Slidr 4","undefined","undefined",
						"undefined", "undefined", "undefined", "undefined", "undefined",
						"undefined", "undefined", "undefined", "undefined", "undefined",
						"Bank Select (fine)", "Modulation Wheel (fine)", "Breath controller (fine)","undefined", "Foot Pedal (fine)",
						"Portamento Time (fine)", "Data Entry (fine)", "Volume (fine)", "Balance (fine)","undefined", 
						"Pan position (fine)", "Expression (fine)", "Effect Control 1 (fine)", "Effect Control 2 (fine)","undefined,",
						"undefined", "undefined", "undefined", "undefined", "undefined",
						"undefined", "undefined", "undefined", "undefined", "undefined",
						"undefined", "undefined", "undefined", "undefined", "undefined", 
						"undefined", "undefined", "Hold Pedal (on/off)","Portamento (on/off)", "Sustenuto Pedal (on/off)", 
						"Soft Pedal (on/off)", "Legato Pedal (on/off)", "Hold 2 Pedal (on/off)", "Sound Variation", "Sound Timbre", 
						"Sound Release Time", "Sound Attack Time", "Sound Brightness", "Sound Control 6", "Sound Control 7", "Sound Control 8", 
						"Sound Control 9", "Sound Control 10", "General Purpose Button 1 (on/of)", "General Purpose Button 2 (on/of)", 
						"General Purpose Button 3 (on/of)", "General Purpose Button 4 (on/of)", "undefined", "undefined", 
						"undefined", "undefined", "undefined", "undefined", "undefined", 
						"Effects Level", "Tremulo Level", "Chorus Level", "Cleste Level", "Phaser Level", "Data Button increment", 
						"Data Button decrement", "Non-registered Parameter (fine)", "Non-registered Parameter (coarse)", 
						"Registered Parameter (fine)", "Registered Parameter (coarse)", "undefined", "undefined",
						"undefined", "undefined", "undefined", "undefined", "undefined",
						"undefined", "undefined", "undefined", "undefined", "undefined",
						"undefined", "undefined", "undefined", "undefined", "undefined",
						"undefined", "All Sound Off", "All Controllers off", "Local Keiboard (on/off)", "All Notes off",
						"Omni Mode off", "Omni Mode on", "Mono Operation", "Poly Operation"];
						
var tab_manufacture = ["nothing", "Sequantial Circuits", "IDP", "Voyetra/Octave Plateau", "Moog Music", "Passport Designs", "Lexicon", "Kurzweil", 
						"Fender", "Gulbransen", "AKG Acoustics", "Voyce Music.", "Waveframe", "ADA", "Garfield Electronics", "Ensoniq","Oberheim", 
						"Apple Computer", "Grey Matter", "DigiDesign", "Palm Tree Instruments", "JL Cooper", "Lowrey", "Adams-Smith","E-mu Systems",
						"Harmony System", "ART", "Baldwin", "Eventide", "Inventronics", "Key Concepts", "Clarity", "Passac", "SIEL","Synthaxe", 
						"Stepp", "Hohner", "Twister", "Solton", "Jellinghaus", "Southworth", "PPG", "JEN", "Solid State Logic", "Audio Veritrieb",
						"Hinton Instruments", "Soundtrack", "Elka", "Dynacord", "nothing", "nothing", "Clavia Digital Instruments", 
						"Audio Architecture", "nothing", "nothing", "nothing", "nothing", "Soundcraft Electronics", "nothing", "Wersi", 
						"Avab Electronik", "Digigram", "Waldorf Electronics", "Quasimidi", "Kawai", "Roland UK / Roland US", "Korg", 
						"Yamaha UK / Yamaha Japan","Casio", "Moridaira", "Kamiya", "Akai", "Japan Victor", "Meisosha", "Hosino Gakki", 
						"Fujitsu Electric", "Sony", "Nishin Onpa", "TEAC", "nothing", "Matsushita Electric", "Fostex", "Zoom", "Midori Eletronics", 
						"Matsushita Communication Industrial", "Suzuki Musical Instrument Mfg.", "Fuji Sound Corporation Ltd.", 
						"Acoustic Technical Laboraty, Inc", "nothing", "Faith, Inc", "Internet Corporation", "nothing", "Seekers Co.Ltd.", 
						"nothing", "nothing", "SD Card Association", "nothing", "nothing", "nothing", "nothing", "nothing", "nothing", "nothing", 
						"nothing", "nothing", "nothing", "nothing", "nothing", "nothing", "nothing", "nothing", "nothing", "nothing", "nothing", 
						"nothing", "nothing", "nothing", "nothing", "nothing", "nothing", "nothing", "nothing", "nothing", "nothing", "nothing", 
						"Non-commercial", "Non Real Time", "Real Time"];
						
var tab_manuf_00 = ["nothing", "Warner New Media", "nothing", "nothing", "nothing", "nothing", "nothing", "Digital Music Corporation", 
					"IOTA Systems", "New England Digital", "Artisyn", "IVL Technologies", "Southern Music Systems", "Lake Butler Sound Company", 
					"Alesis", "nothing", "DOD Electronics", "Studer", "nothing", "nothing", "Perfect Fretworks", "KAT", "Opcode", 
					"Rane Corporation", "Spatial Sound/Anadi Inc", "KMX", "Allen & Heath Brenell", "Peavey Electronics", "360 Systems", 
					"Spectrum Design & Development", "Marquis Musi", "Zeta Systems", "Axxes", "Orban", "nothing", "nothing", "KTI", 
					"Breakamy Technologies", "CAE", "nothing", "nothing", "Rocktron Corp.", "PianoDisc", "Cannon Research Corporation", "nothing",
					"Rogers Instrument Corp.", "Blue Sky Logic", "Encore Electronics", "Uptown", "Voce", "CTI Audio", "S&S Research", 
					"Broderbund Software", "Allen Organ Co.", "nothing", "Music Quest", "Aphex", "Gallien Krueger", "IBM", "nothing", 
					"Hotz Instruments Technologies", "ETA Lighting", "NSI Corporation", "Ad Lib", "Richmond Sound Design", "Microsoft", 
					"The Software Toolworks", "RJMG/Niche", "Intone", "nothing", "nothing", "GT Electronics/Groove Tubes", "nothing", "nothing", 
					"nothing", "nothing", "nothing", "nothing", "Euphonix", "InterMIDI", "nothing", "nothing", "nothing", "nothing", "nothing",
					"Lone Wolf", "nothing", "nothing", "nothing", "nothing", "nothing", "nothing", "nothing", "nothing",
					"nothing", "nothing", "nothing", "nothing", "nothing", "nothing", "Musonix", "nothing", "nothing",
					"nothing", "nothing", "nothing", "nothing", "nothing", "nothing", "nothing", "nothing",
					"nothing", "nothing", "nothing", "nothing", "nothing", "Ta Horng Musical Inst.", "eTek",
					"Electrovoice", "Midisoft", "Q-Sound Labs", "Westrex", "NVidia", "ESS Technology", 
					"MediaTrix Peripherals", "Brooktree", "Otari", "Key Electronics"];

var tab_manuf_01 = ["Shure Incorporated", "AuraSound", "Crystal Semiconductor", "Conexant (Rockwell)", "Silicon Graphics", "M-Audio (Midiman)",
					"PreSound", "nothing", "Topaz Enterprises", "Cast Lighting", "Microsoft", "Sonic Foundry", "Line 6 (Fast Forward)",
					"Beatnik Inc", "Van Koevering Company", "Altech Systems", "S&S Research", "VLSI Technology", "Chromatic Research","Sapphire", 
					"IDRC", "Justonic Tuning", "TorComp Research Inc.", "Newtek Inc.", "Sound Sculpture", "Walker Technical", 
					"Digital Harmony (PAVO)", "InVision Interactive", "T-Square Design", "Nemesys Music Technology",
					"DBX Professional (Harman Intl)", "Syndyne Corporation", "Bitheadz", "Cakewalk Music Software", "Analog Devices", 
					"National Semiconductor", "Boom Theory/Adinolfi Alternative Percussion", "Virtual DSP Corporation", "Antares Systems", 
					"Angel Software", "St Louis Music", "Passport Music Software LLC", "Ashley Audio Inc.", "Vari-Lite Inc.", "Summit Audio Inc.", 
					"Aureal Semiconductor Inc.", "SeaSound LLC", "U.S. Robotics", "Aurisis Research", "Nearfield Research", "FM7 Inc", 
					"Swivel Systems", "Hyperactive Audio Systems", "MidiLite (Castle Studios Productions)", "Radikal Technologies", 
					"Roger Linn Design", "TC-Helicon Vocal Technologies", "Event Electronics", "Sonic Network Inc", "Realtime Music Solutions", 
					"Apogee Digital", "Classical Organs, Inc.", "Microtools Inc.", "Numark Industries", "Frontier Design Group, LLC", 
					"Recordare LLC", "Starr Labs", "Voyager Sound Inc.", "Manifold Labs", "Aviom Inc.", "Mixmeister Technology", 
					"Notation Software", "Mercurial Communications", "Wave Arts", "Logic Sequencing Devices", "Axess Electronics", "Muse Research",
					"Open Labs", "Guillemot Corp", "Samson Technologies", "Electronic Theatre Controls", "Blackberry (RIM)", "Mobileer", "Synthogy",
					"Lynx Studio Technology Inc.", "Damage Control Engineering LLC", "Yost Engineering, Inc.", 
					"Brooks & Forsman Designs LLC / DrumLite", "Infinite Response", "Garritan Corp", "Plogue Art et Technologie", 
					"RJM Music Technology", "Custom Solutions Software", "Sonarcana LLC", "Centrance", "Kesumo LLC", "Stanton (Gibson)", 
					"Livid Instruments", "First Act/745 Media", "Pygraphics, Inc.", "Panadigm Innovations Ltd", "Avedis Zildjian Co", 
					"Auvital Music Corp", "You Rock Guitar ", "Chris Grigg Designs", "Slate Digital LLC", "Mixware", "Social Entropy", 
					"Source Audio LLC", "Ernie Ball / Music Man", "Fishman", "Custom Audio Electronics", "American Audio/DJ", 
					"Mega Control Systems", "Kilpatrick Audio", "iConnectivity", "Fractal Audio", "NetLogic Microsystems", "Music Computing",
					"Nektar Technology Inc", "Zenph Sound Innovations", "DJTechTools", "Rezonance Labs", "Decibel Eleven", "CNMAT", 
					"Media Overkill", "Confusionists LLC", "moForte Inc"];

var tab_manuf_02 = ["Miselu Inc", "Amelia's Compass LLC", "Zivix LLC", "Artiphon", "Synclavier Digital", "Light & Sound Control Devices LLC",
					"Retronyms Inc", "JS Technologies", "Quicco Sound", "A-Designs Audio"];

var tab_manuf_20 = ["Dream", "Strand Lighting", "AMEK Systems & Controls", "nothing", "Dr.Bohm/Musician International", "nothing", "Trident", 
					"Real World Design", "nothing", "Yes Technology", "Audiomatica", "Bontempi/Farfisa", "F.B.T. Electronica", "MIDITEMP", 
					"Larking Audio", "Zero 88 Lighting", "Micon Audio Electronics", "Forefront Technology", "nothing", "Kenton Electronics", 
					"nothing", "ADB", "Jim Marshall Products", "DDA", "BSS Audio", "nothing", "nothing", "nothing", "nothing", "nothing", "nohing",
					"TC Electronic", "nothing", "nothing", "nothing", "nothing", "nothing", "nothing",
					"nothing", "nothing", "nothing", "Focusrite/Novation", "Samkyung Mechatronics", "Medeli Electronics Co.", "Charlie Lab SRL",
					"Blue Chip Music Technology", "BEE OH Corp", "LG Semicon America", "TESI", "EMAGIC", "Behringer GmbH", 
					"Access Music Electronics", "Synoptic", "Hanmesoft", "Terratec Electronic GmbH", "Proel SpA", "IBK MIDI", "IRCAM", 
					"Propellerhead Software", "Red Sound Systems Ltd", "Elektron ESI AB", "Sintefex Audio", "MAM (Music and More)", "Amsaro GmbH", 
					"CDS Advanced Technology BV (Lanbox)", "Mode Machines (Touched By Sound GmbH)", "DSP Arts", "Phil Rees Music Tech", 
					"Stamer Musikanlagen GmbH", "Musical Muntaner S.A. dba Soundart", "C-Mexx Software", "Klavis Technologies", "Noteheads AB", 
					"Algorithmix", "Skrydstrup R&D", "Professional Audio Company", "NewWave Labs (MadWaves)", "Vermona", "Nokia", "Wave Idea", 
					"Hartmann GmbH", "Lion's Tracs", "Analogue Systems", "Focal-JMlab", "Ringway Electronics", "Faith Technologies", "Showworks", 
					"Manikin Electronic", "1 Come Tech", "Phonic Corp", "Dolby Australia (Lake)", "Silansys Technologies", "Winbond Electronics", 
					"Cinetix Medien und Interface GmbH", "A&G Soluzioni Digitali", "Sequentix Music Systems", "Oram Pro Audio", "Be4 Ltd", 
					"Infection Music", "Central Music Co.", "genoQs Machines GmbH", "Medialon", "Waves Audio Ltd", "Jerash Labs", "Da Fact", 
					"Elby Designs", "Spectral Audio", "Arturia", "Vixid", "C-Thru Music", "Ya Horng Electronic Co LTD", "SM Pro Audio", 
					"OTO MACHINES", "ELZAB S.A.", "Blackstar Amplification Ltd", "M3i Technologies GmbH", "Gemalto (from Xiring)", "Prostage SL", 
					"Teenage Engineering", "Tobias Erichsen Consulting", "Nixer Ltd", "Hanpin Electron Co Ltd", "'MIDI-hardware' R.Sowa", 
					"Beyond Music Industrial Ltd", "Kiss Box B.V.", "Misa Digital Technologies Ltd", "AI Musics Technology Inc", "Serato Inc LP"];	

var tab_manuf_21 = ["Limex", "Kyodday (Tokai)", "Mutable Instruments", "PreSonus Software Ltd", "Xiring", "Fairlight Instruments Pty Ltd", 
					"Musicom Lab", "Modulus (VacoLoco)", "RWA (Hong Kong) Limited", "Native Instruments", "Naonext", "MFB", "Teknel Research", 
					"Ploytec GmbH", "Surfin Kangaroo Studio", "Philips Electronics HK Ltd", "ROLI Ltd", "Panda-Audio Ltd", "BauM Software",
					"Machinewerks Ltd.", "Xiamen Elane Electronics", "Marshall Amplification PLC", "Kiwitechnics Ltd", "Rob Papen",
					"Spicetone OU", "V3Sound", "IK Multimedia", "Novalia Ltd", "Modor Music"];

var tab_manuf_40 = ["Crimson Technology Inc.", "Softbank Mobile Corp", "D&M Holdings Inc."];

function decode()
{
	var baud = 31250;
	var nbits = 8; 
	var stop = 1;
	var byte_status = true;
	var byte_sys = true;
	var num_byte_note = 0;
	var num_byte_sys = 0;
	var end_pkt = true;
	var next = true;
	var s_pos, p_pos, b, s, val;
	var par;
	var spb;
	var m;
	var logic1, logic0;
	var bit;

	if (!check_scanastudio_support())
    {
        add_to_err_log("Please update your ScanaStudio software to the latest version to use this decoder");
        return;
    }

	PKT_COLOR_DATA         			 = get_ch_light_color(ch);
	PKT_COLOR_DATA_TITLE  			 = dark_colors.gray;
	PKT_COLOR_START_TITLE 			 = dark_colors.green;			
	PKT_COLOR_STOP_TITLE 			 = dark_colors.red;
	PKT_COLOR_SONG_POS_TITLE		 = light_colors.blue;				
	PKT_COLOR_SONG_SELECT_TITLE 	 = dark_colors.blue;
	PKT_COLOR_MIDI_START			 = dark_colors.pink;					
	PKT_COLOR_MIDI_STOP 		     = dark_colors.brown;
	PKT_COLOR_CONTINUE				 = dark_colors.orange;				
	PKT_COLOR_RESET 			     = dark_colors.black;
	PKT_COLOR_TUNING				 = light_colors.green;				
	PKT_COLOR_TEMPO 				 = dark_colors.violet;
	PKT_COLOR_ACTIVE_SENS			 = light_colors.yellow;			
	PKT_COLOR_MANUFACTURER_TITLE 	 = dark_colors.blue;
	PKT_COLOR_NOTE_ON_TITLE			 = light_colors.blue;			
	PKT_COLOR_NOTE_OFF_TITLE 		 = dark_colors.blue;
	PKT_COLOR_AFTERTOUCH_TITLE		 = dark_colors.green;			
	PKT_COLOR_CHANNEL_PRESSURE_TITLE = light_colors.green;
	PKT_COLOR_CONTROL_CHANGE_TITLE   = dark_colors.brown;			
	PKT_COLOR_PITCH_WHEEL_TITLE 	 = light_colors.brown;
	PKT_COLOR_PITCH_WHEEL_TITLE		 = light_colors.yellow;			
	PKT_COLOR_CHANNEL_TITLE 		 = dark_colors.violet;
	PKT_COLOR_PROGRAM_CHANGE_TITLE   = dark_colors.yellow;

	get_ui_vals();
	var t = trs_get_first(ch);

	spb = sample_rate / baud;
	m = spb / 10;

	logic1 = 1;
	logic0 = 0;

	while (trs_is_not_last(ch))
	{
		if (abort_requested () == true)
		{
			pkt_end();
			return false;
		}

		t = get_next_falling_edge(ch, t);

		if (t == false)
		{
			return;
		} 

		bit_sampler_ini(ch, spb / 2, spb);
		bit_sampler_next(ch);

		if (trs_is_not_last(ch) == false)
		{
			break;
		}

		if (end_pkt == true)
		{
			pkt_start("MIDI");
		}

		if (num_byte_sys != 2)
		{
			if (num_byte_sys == 3)
			{
				dec_item_new(ch, id_1s_byte_start_sample, t.sample + (spb * (nbits + 1 + 1)));
			}
			else
			{
				dec_item_new(ch, t.sample, t.sample + (spb * (nbits + 1 + 1)));
			}
		}
		else
		{
			id_1s_byte_start_sample = t.sample;
		}

		par = 0;
		val = 0;
		var midSample = t.sample + (spb * 3 / 2);

		for (b = 0; b < nbits; b++)
		{
			bit = bit_sampler_next(ch);

			val += Math.pow(2, b) * bit;
			par = par ^ bit;

			dec_item_add_sample_point(ch, midSample, bit ? DRAW_1 : DRAW_0);
			midSample += spb;
		}

		var asciiChar = String.fromCharCode(val);
		strHexData = int_to_str_hex(val);
		var string_status = "";

		if (byte_sys == true)
		{
			next = true;
			string_status += get_system_status(val);

			if (string_status != "")
			{
				num_byte_sys = 0;
				byte_sys = false;
				byte_status = false;
				next = false;
				num_byte_sys++;
				end_pkt = false;
			}
		}
		else
		{
			string_status += get_system_data(val, num_byte_sys);

			if (string_status != "")
			{
				num_byte_sys++;
			}

			if (string_status == "SysEx End ")
			{
			    get_system_status(val);
				byte_sys = true;
				byte_status = true;
				state_system = Nothing_Status;
				end_pkt = true;
			}
			else if (((state_system == Song_Position) || (state_system == Song_Select)) && (num_byte_sys == 3))
			{
				byte_sys = true;
				byte_status = true;
				state_system = Nothing_Status;
				end_pkt = true;
			}
			else if ((state_system != Song_Position) && (state_system != Song_Select) && (state_system != SysEx_Start))
			{
				byte_sys = true;
				byte_status = true;
				state_system = Nothing_Status;
				end_pkt = true;
			}
		}

		if ((byte_status == true) && (next == true))	
		{
			string_status += get_voice_status(val);

			if (string_status != "")
			{
				byte_status = false;
				num_byte_note++;
				end_pkt = false;
			}
		}
		else if ((byte_status == false) && (byte_sys == true))
		{		
			string_status += get_voice_data(val, num_byte_note);

			if (string_status != "")
			{
				num_byte_note++;
			}
		}

		if (string_status != "Manufacturer ID ")
		{
			if (string_status == "Other manufacturer ")
			{
				dec_item_add_comment(string_status);
			}
			else
			{
				dec_item_add_comment(string_status + strHexData);
			}
		}
		else
		{
			dec_item_add_comment(string_status);
		}

		string_status = "";

		if (num_byte_note == 3)
		{
			byte_status = true;
			num_byte_note = 0;
			state_voice = Nothing_Status;
			end_pkt = true;
		}		

		hex_add_byte(ch, -1, -1, val);
		t.sample += (spb * (nbits + 1));

		if (end_pkt == true)
		{
			pkt_end();
		}

		t = trs_go_after(ch, t.sample + (spb * stop * 0.5));
		set_progress(100 * t.sample / n_samples);
	}
}

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

function get_ch_light_color (k)
{
    var chColor = get_ch_color(k);

    chColor.r = (chColor.r * 1 + 255 * 3) / 4;
    chColor.g = (chColor.g * 1 + 255 * 3) / 4;
    chColor.b = (chColor.b * 1 + 255 * 3) / 4;

    return chColor;
}

function get_next_falling_edge (ch, trStart)
{
	var tr = trStart;
	
	while ((tr.val != FALLING) && (trs_is_not_last(ch) == true))
	{
		tr = trs_get_next(ch);
	}

	if (trs_is_not_last(ch) == false) tr = false;

	return tr;
}

function get_voice_status (data)
{
	var channel;
	var state_status = "";
	var next = false;

	if ((data >= 0x80) && (data <= 0x8F))
	{
		channel = data & 0x0F;

		dec_item_add_pre_text("Note Off ");
		dec_item_add_pre_text("OFF ");
		dec_item_add_post_text("channel " + channel);
		dec_item_add_post_text("ch " + channel);
		dec_item_add_post_text("!" + channel);
		dec_item_add_post_text(channel);

		state_status += "Note Off ";
		state_voice = Note_Off;

		pkt_add_item(-1, -1, "Note OFF", "CH" + channel, PKT_COLOR_NOTE_OFF_TITLE, PKT_COLOR_DATA, true);
	}
	else if ((data>= 0x90) && (data <= 0x9F))
	{
		channel = data & 0x0F;

		dec_item_add_pre_text("Note On "); 
		dec_item_add_pre_text("ON ");
		dec_item_add_post_text("channel " + channel);
		dec_item_add_post_text("ch " + channel);
		dec_item_add_post_text(channel);

		state_status += "Note On ";
		state_voice = Note_On;

		pkt_add_item(-1, -1, "Note ON", "CH" + channel, PKT_COLOR_NOTE_ON_TITLE, PKT_COLOR_DATA, true);
	}
	else if((data >= 0xA0) && (data <= 0xAF))
	{
		channel = data & 0x0F;

		dec_item_add_pre_text("Aftertouch,"); 
		dec_item_add_post_text(" channel " + channel);
		dec_item_add_post_text(" ch " + channel);
		dec_item_add_post_text(" " + channel);
		dec_item_add_post_text(channel);

		state_status += "Aftertouch";
		state_voice = Aftertouch;

		pkt_add_item(-1, -1, "Aftertouch", "CH" + channel, PKT_COLOR_AFTERTOUCH_TITLE, PKT_COLOR_DATA, true);
	}
	else if ((data >= 0xB0) && (data <= 0xBF))
	{
		channel = data & 0x0F;

		dec_item_add_pre_text("Control Change,"); 
		dec_item_add_post_text(" channel " + channel);
		dec_item_add_post_text(" ch " + channel);
		dec_item_add_post_text(" " + channel);

		state_status += "Control Change";
		state_voice = Control_Change;

		pkt_add_item(-1, -1, "Control Change", "CH" + channel, PKT_COLOR_CONTROL_CHANGE_TITLE, PKT_COLOR_DATA, true);
	}
	else if ((data>= 0xC0) && (data <= 0xCF))
	{
		channel = data & 0x0F;

		dec_item_add_pre_text("Program Change,"); 
		dec_item_add_post_text(" channel " + channel);
		dec_item_add_post_text(" ch " + channel);
		dec_item_add_post_text(" " + channel);

		state_status += "Program Change";
		state_voice = Program_Change;

		pkt_add_item(-1, -1, "Program Change", "CH" + channel, PKT_COLOR_PROGRAM_CHANGE_TITLE, PKT_COLOR_DATA, true);
	}
	else if ((data >= 0xD0) && (data <= 0xDF))
	{
		channel = data & 0x0F;

		dec_item_add_pre_text("Channel Pressure,"); 
		dec_item_add_post_text(" channel "+ channel);
		dec_item_add_post_text(" ch " + channel);
		dec_item_add_post_text(" " + channel);

		state_status += "Channel Pressure";
		state_voice = Channel_Pressure;

		pkt_add_item(-1, -1, "Channel Pressure", "CH" + channel, PKT_COLOR_CHANNEL_PRESSURE_TITLE, PKT_COLOR_DATA, true);
	}
	else if ((data>= 0xE0) && (data <= 0xEF))
	{
		channel = data & 0x0F;

		dec_item_add_pre_text("Pitch Wheel,");
		dec_item_add_post_text(" channel " + channel);
		dec_item_add_post_text(" ch " + channel);
		dec_item_add_post_text(" " + channel);

		state_status += "Pitch Wheel";
		state_voice = Pitch_Wheel;

		pkt_add_item(-1, -1, "Pitch Wheel", "CH" + channel, PKT_COLOR_PITCH_WHEEL_TITLE, PKT_COLOR_DATA, true);
	}
	else
	{
		dec_item_add_pre_text("Missing status byte");
	}

	return state_status;
}

function get_voice_data (data, byte_n)
{
	var state_note = "";

	switch (state_voice)
	{
		case Note_Off:
			if(byte_n == 1)
			{
				dec_item_add_pre_text("Note : " + tab_note[data]);
				dec_item_add_pre_text("N " + tab_note[data]);
				dec_item_add_pre_text(tab_note[data]);
				dec_item_add_pre_text("...");
				state_note = "Note : ";
				pkt_add_item(-1, -1, tab_note[data], data, PKT_COLOR_DATA_TITLE, PKT_COLOR_DATA, true);
			}
			
			if(byte_n == 2)
			{
				dec_item_add_pre_text("velocity : "+data);
				dec_item_add_pre_text("vel : "+data);
				dec_item_add_pre_text("v "+data);
				dec_item_add_pre_text("...");
				state_note = "velocity : ";
				pkt_add_item(-1, -1, "Velocity", data, PKT_COLOR_DATA_TITLE, PKT_COLOR_DATA, true);
			}	
					
		break;
		
		case Note_On:
			if(byte_n == 1)
			{
				dec_item_add_pre_text("Note : " + tab_note[data]);
				dec_item_add_pre_text("N " + tab_note[data]);
				dec_item_add_pre_text(tab_note[data]);
				dec_item_add_pre_text("...");
				state_note = "Note : ";
				pkt_add_item(-1, -1, tab_note[data], data, PKT_COLOR_DATA_TITLE, PKT_COLOR_DATA, true);
			}
			
			if(byte_n == 2)
			{
				dec_item_add_pre_text("velocity : "+data);
				dec_item_add_pre_text("vel : "+data);
				dec_item_add_pre_text("v "+data);
				dec_item_add_pre_text("...");
				state_note = "velocity : ";
				pkt_add_item(-1, -1, "Velocity", data, PKT_COLOR_DATA_TITLE, PKT_COLOR_DATA, true);
			}
		break;
		
		case Aftertouch:
			if(byte_n == 1)
			{
				dec_item_add_pre_text("Note : " + tab_note[data]);
				dec_item_add_pre_text("N " + tab_note[data]);
				dec_item_add_pre_text(tab_note[data]);
				dec_item_add_pre_text("...");
				state_note = "Note : ";
				pkt_add_item(-1, -1, tab_note[data], data, PKT_COLOR_DATA_TITLE, PKT_COLOR_DATA, true);
			}
			
			if(byte_n == 2)
			{
				dec_item_add_pre_text("pressure : "+data);
				dec_item_add_pre_text("pres : "+data);
				dec_item_add_pre_text("p "+data);
				dec_item_add_pre_text("...");
				state_note = "pressure : ";
				pkt_add_item(-1, -1, "Pressure", data, PKT_COLOR_DATA_TITLE, PKT_COLOR_DATA, true);
			}
		break;
		
		case Control_Change:
			if(byte_n == 1)
			{
				dec_item_add_pre_text(tab_controllers[data]);
				dec_item_add_pre_text("...");
				state_note = "Controllers : ";
				pkt_add_item(-1, -1, "Controllers", data, PKT_COLOR_DATA_TITLE, PKT_COLOR_DATA, true);
			}
			
			if(byte_n == 2)
			{
				dec_item_add_pre_text("value : "+data);
				dec_item_add_pre_text("v "+data);
				dec_item_add_pre_text("...");
				state_note = "value : ";
				pkt_add_item(-1, -1, "Value", data, PKT_COLOR_DATA_TITLE, PKT_COLOR_DATA, true);
			}
		break;
		
		case Program_Change:
			if(byte_n == 1)
			{
				dec_item_add_pre_text(tab_program_group[data/8]);
				dec_item_add_pre_text(tab_program_instrument[data]);
				dec_item_add_pre_text("...");
				state_note = "Program : ";
				pkt_add_item(-1, -1, "Programm", data, PKT_COLOR_DATA_TITLE, PKT_COLOR_DATA, true);
			}
			
			if(byte_n == 2)
			{
				state_note = "Nothing";
			}
		break;
		
		case Channel_Pressure:
			if(byte_n == 1)
			{
				dec_item_add_pre_text("pressure : "+data);
				dec_item_add_pre_text("pres : "+data);
				dec_item_add_pre_text("p "+data);
				dec_item_add_pre_text("...");
				state_note = "pressure : ";
				pkt_add_item(-1, -1, "Pressure", data, PKT_COLOR_DATA_TITLE, PKT_COLOR_DATA, true);
			}
			
			if(byte_n == 2)
			{
				state_note = "Nothing";
			}
		break;
		
		case Pitch_Wheel:
			if(byte_n == 1)
			{
				dec_item_add_pre_text("LSB "+data);
				dec_item_add_pre_text("...");
				state_note = "Pitch Whee LSB : ";
			}
			
			if(byte_n == 2)
			{
				dec_item_add_pre_text("MSB "+data);
				dec_item_add_pre_text("...");
				state_note = "Pitch Whee MSB : ";
			}
			pkt_add_item(-1, -1, "Data", data, PKT_COLOR_DATA_TITLE, PKT_COLOR_DATA, true);
		break;
			
		default:	
			dec_item_add_pre_text("Error");
		break;
	}

	return state_note;

}

function get_system_status (data)
{
	var state_SysEx = "";

	switch (data)
	{
		case 0xF0:
			dec_item_add_pre_text("SysEx Start");
			dec_item_add_pre_text("SE Start");
			dec_item_add_pre_text("SE S");
			dec_item_add_pre_text("SE");
			state_SysEx += "SysEx Start ";
			state_system = SysEx_Start;
			pkt_add_item(-1, -1, "SysEx Start", " ",PKT_COLOR_START_TITLE, PKT_COLOR_DATA, true);
		break;

		case 0xF7:
			dec_item_add_pre_text("SysEx End");
			dec_item_add_pre_text("SE Stop");
			dec_item_add_pre_text("SE P");
			dec_item_add_pre_text("!SE");
			state_SysEx += "SysEx End ";
			state_system = SysEx_Stop;
			pkt_add_item(-1, -1, "SysEx Start", " ", PKT_COLOR_STOP_TITLE, PKT_COLOR_DATA, true);
			byte_1 = 0xFF;
		break;
				
		case 0xF2:
			dec_item_add_pre_text("Song position pointer");
			dec_item_add_pre_text("Song position");
			dec_item_add_pre_text("Song pos");
			dec_item_add_pre_text("SongP");
			dec_item_add_pre_text("...");
			state_SysEx += "Song position pointer ";
			state_system = Song_Position;
			pkt_add_item(-1, -1, "Song position pointer", " ", PKT_COLOR_SONG_POS_TITLE, PKT_COLOR_DATA, true);
		break;
		
		case 0xF3:
			dec_item_add_pre_text("Song select");
			dec_item_add_pre_text("Song sel");
			dec_item_add_pre_text("SongS");
			dec_item_add_pre_text("...");
			state_SysEx += "Song select ";
			state_system = Song_Select;
			pkt_add_item(-1, -1, "Song select", " ", PKT_COLOR_SONG_SELECT_TITLE, PKT_COLOR_DATA, true); 
		break;
		
		case 0xF6:
			dec_item_add_pre_text("Tuning");
			dec_item_add_pre_text("Tune");
			dec_item_add_pre_text("...");
			state_SysEx += "Tuning ";
			state_system = Tuning;
			pkt_add_item(-1, -1, "Tuning", " ", PKT_COLOR_TUNING, PKT_COLOR_DATA, true);
		break;
		
		case 0xF8:
			dec_item_add_pre_text("MIDI Clock");
			dec_item_add_pre_text("Clock");
			dec_item_add_pre_text("CLK");
			dec_item_add_pre_text("...");
			state_SysEx += "MIDI Clock ";
			state_system = Tempo;
			pkt_add_item(-1, -1, "MIDI Clock", " ", PKT_COLOR_TEMPO, PKT_COLOR_DATA, true);
		break;
		
		case 0xFA:
			dec_item_add_pre_text("MIDI Start");
			dec_item_add_pre_text("Start");
			dec_item_add_pre_text("S");
			state_SysEx += "MIDI Start ";
			state_system = Start_MIDI;
			pkt_add_item(-1, -1, "MIDI Start", " ", PKT_COLOR_MIDI_START, PKT_COLOR_DATA, true); 
		break;
		
		case 0xFB:
			dec_item_add_pre_text("MIDI Continue");
			dec_item_add_pre_text("Continue");
			dec_item_add_pre_text("C");
			state_SysEx += "MIDI Continue ";
			state_system = Continue_MIDI;
			pkt_add_item(-1, -1, "MIDI Continue", " ", PKT_COLOR_CONTINUE, PKT_COLOR_DATA, true);
		break;
		
		case 0xFC:
			dec_item_add_pre_text("MIDI Stop");
			dec_item_add_pre_text("Stop");
			dec_item_add_pre_text("!S");
			state_SysEx += "MIDI Stop ";
			state_system = Stop_MIDI;
			pkt_add_item(-1, -1, "MIDI Stop", " ", PKT_COLOR_MIDI_STOP, PKT_COLOR_DATA, true);
		break;
		
		case 0xFE:
			dec_item_add_pre_text("Active sensing");
			dec_item_add_pre_text("Act Sensing");
			dec_item_add_pre_text("ActSens");
			dec_item_add_pre_text("AS");
			state_SysEx += "Active sensing ";
			state_system = Active_Sensing;
			pkt_add_item(-1, -1, "Active sensing", " ", PKT_COLOR_ACTIVE_SENS, PKT_COLOR_DATA, true); 
		break;
		
		case 0xFF:
			dec_item_add_pre_text("Reset Instrument");
			dec_item_add_pre_text("Reset");
			dec_item_add_pre_text("R");
			state_SysEx += "Reset Instrument ";
			state_system = Reset;
			pkt_add_item(-1, -1, "Reset Instrument", " ", PKT_COLOR_RESET, PKT_COLOR_DATA, true); 
		break;
	
	}

	return state_SysEx;
}

function get_system_data (data, byte_n)
{
	var state_data_sys = "";

	switch (state_system)
	{
		case SysEx_Start:

			if (data != 0xF7)
			{
				state_data_sys += get_system_ex_data(data, byte_n);
			}		
			else
			{
				state_data_sys += "SysEx End "
			}

		break;

		case Song_Position:

			if (byte_n == 1)
			{
				dec_item_add_pre_text("Position LSB "+data);
				dec_item_add_pre_text("Pos LSB "+data);
				dec_item_add_pre_text("LSB "+data);
				dec_item_add_pre_text("...");
				state_note = "Position LSB : ";
			}

			if (byte_n == 2)
			{
				dec_item_add_pre_text("Position MSB "+data);
				dec_item_add_pre_text("MSB "+data);
				dec_item_add_pre_text("...");
				state_note = "Position MSB : ";
			}

			pkt_add_item(-1, -1, "Data", strHexData, PKT_COLOR_DATA_TITLE, PKT_COLOR_DATA, true);

		break;

		case Song_Select:

			if (byte_n == 1)
			{
				dec_item_add_pre_text("Song "+data);
				dec_item_add_pre_text(data);
				dec_item_add_pre_text("...");
				state_note = "Program : ";
				pkt_add_item(-1, -1, "Song ", data, PKT_COLOR_DATA_TITLE, PKT_COLOR_DATA, true);
			}

			if(byte_n == 2)
			{
				state_note = "Nothing";
			}

		break;

/*		case Tuning:
			if(byte_n == 1)
			{
				state_note = "Nothing";
			}
			if(byte_n == 2)
			{
				state_note = "Nothing";
			}
		break;
		
		case Tempo:
			if(byte_n == 1)
			{
				state_note = "Nothing";
			}
			if(byte_n == 2)
			{
				state_note = "Nothing";
			}
		break;
		
		case Start_MIDI:
			if(byte_n == 1)
			{
				state_note = "Nothing";
			}
			if(byte_n == 2)
			{
				state_note = "Nothing";
			}
		break;
		
		case Continue_MIDI:
			if(byte_n == 1)
			{
				state_note = "Nothing";
			}
			if(byte_n == 2)
			{
				state_note = "Nothing";
			}
		break;
		
		case Stop_MIDI:
			if(byte_n == 1)
			{
				state_note = "Nothing";
			}
			if(byte_n == 2)
			{
				state_note = "Nothing";
			}
		break;
		
		case Active_Sensing:
			if(byte_n == 1)
			{
				state_note = "Nothing";
			}
			if(byte_n == 2)
			{
				state_note = "Nothing";
			}
		break;
		
		case Reset:
			if(byte_n == 1)
			{
				state_note = "Nothing";
			}
			if(byte_n == 2)
			{
				state_note = "Nothing";
			}
		break;*/
	}

	return state_data_sys
}

function get_system_ex_data (data, byte_n)
{
	var state_data = "";

	if (byte_n == 1)
	{
		if (data == 0)
		{
			ID_2byte = true;
			state_data += "Other manufacturer ";
			dec_item_add_pre_text("Other manufacturer");
			dec_item_add_pre_text("Ohter");
			dec_item_add_pre_text("...");
     	}
		else
		{
			dec_item_add_pre_text(tab_manufacture[data]);
			dec_item_add_pre_text("...");
			ID_2byte = false;
			state_data += "Manufacturer ID ";
			pkt_add_item(-1, -1, "Manufacturer ID", tab_manufacture[data], PKT_COLOR_MANUFACTURER_TITLE, PKT_COLOR_DATA, true);	
		}
	}
	else if (byte_n == 2)
	{
		if (ID_2byte == true)
		{
			byte_1 = data;
			state_data += "Other manufacturer ";
		}
		else
		{
			dec_item_add_pre_text("Data ");
			dec_item_add_pre_text("...");
			state_data += "Data ";
			dec_item_add_data(data);
			pkt_add_item(-1, -1, "Data", strHexData, PKT_COLOR_DATA_TITLE, PKT_COLOR_DATA, true);
		}		
	}

	else if (byte_n == 3)
	{
		if (ID_2byte == true)
		{
			switch (byte_1)
			{
				case 0x00:
					dec_item_add_pre_text(tab_manuf_00[data]);
					dec_item_add_pre_text("...");
					pkt_add_item(-1, -1, "Manufacturer ID", tab_manuf_00[data], PKT_COLOR_MANUFACTURER_TITLE, PKT_COLOR_DATA, true);	
				break;
				
				case 0x01:
					dec_item_add_pre_text(tab_manuf_01[data]);
					dec_item_add_pre_text("...");
					pkt_add_item(-1, -1, "Manufacturer ID", tab_manuf_01[data], PKT_COLOR_MANUFACTURER_TITLE, PKT_COLOR_DATA, true);	
				break;
				
				case 0x02:
					dec_item_add_pre_text(tab_manuf_02[data]);
					dec_item_add_pre_text("...");
					pkt_add_item(-1, -1, "Manufacturer ID", tab_manuf_02[data], PKT_COLOR_MANUFACTURER_TITLE, PKT_COLOR_DATA, true);	
				break;
				
				case 0x020:
					dec_item_add_pre_text(tab_manuf_20[data]);
					dec_item_add_pre_text("...");
					pkt_add_item(-1, -1, "Manufacturer ID", tab_manuf_20[data], PKT_COLOR_MANUFACTURER_TITLE, PKT_COLOR_DATA, true);	
				break;
				
				case 0x21:
					dec_item_add_pre_text(tab_manuf_21[data]);
					dec_item_add_pre_text("...");
					pkt_add_item(-1, -1, "Manufacturer ID", tab_manuf_21[data], PKT_COLOR_MANUFACTURER_TITLE, PKT_COLOR_DATA, true);	
				break;
				
				case 0x40:
					dec_item_add_pre_text(tab_manuf_40[data]);
					dec_item_add_pre_text("...");
					pkt_add_item(-1, -1, "Manufacturer ID", tab_manuf_40[data], PKT_COLOR_MANUFACTURER_TITLE, PKT_COLOR_DATA, true);	
				break;
				
				default:
					dec_item_add_pre_text("Error");
				break;
			}

			state_data += ("Manufacturer ID ");
			ID_2byte = false;
		}
		else
		{
			dec_item_add_pre_text("Data ");
			dec_item_add_pre_text("...");
			state_data += "Data ";
			dec_item_add_data(data);
			pkt_add_item(-1, -1, "Data", strHexData, PKT_COLOR_DATA_TITLE, PKT_COLOR_DATA, true);
		}
	}
	else if (byte_n > 3)
	{
		dec_item_add_pre_text("Data ");
		dec_item_add_pre_text("...");
		state_data += "Data ";
		
		dec_item_add_data(data);
		pkt_add_item(-1, -1, "Data", strHexData, PKT_COLOR_DATA_TITLE, PKT_COLOR_DATA, true);
			
	}

	return state_data;
}
