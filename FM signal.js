/*
*************************************************************************************

							SCANASTUDIO 2 DECODER

The following commented block allows some related informations to be displayed online

<DESCRIPTION>

	Simple script to help generating FM signals

</DESCRIPTION>

<RELEASE_NOTES>

	 V1.0:  Initial release

</RELEASE_NOTES>

<AUTHOR_URL>

	mailto:i.kamal@ikalogic.com

</AUTHOR_URL>

<HELP_URL>



</HELP_URL>

*************************************************************************************
*/

/* The decoder name as it will apear to the users of this script 
*/
function get_dec_name()
{
	return "FM signal";
}

/* The decoder version 
*/
function get_dec_ver()
{
	return "1.0";
}

/* Author 
*/
function get_dec_auth()
{
	return "Ibrahim KAMAL";
}

/* Graphical user interface for this decoder 
*/
function gui()
{
	ui_clear();	// clean up the User interface before drawing a new one.
}

//Sine modulated FM signal template
function generator_template() {
    /*
    *   Frequency modulated signal generator
    */

    //setup your own parameters here:
    var target_channel = 0; //generate on channel 1
    var f_min = 5000;	//5KHz
    var f_max = 20000;	//20KHz
    var start_angle = 90*Math.PI/180; //start angle in radians
    var sine_freq = 1000;	//Modulated sine wave frequency = 1 KHz

    /*
    *   Start of generator script,
    *   No need to modify below this line
    */

    //start of the generator script
    var sample_rate = get_sample_rate();
    var total_samples = get_maximum_samples();
    // Some sanity checks first
    if (f_max <= f_min)
    {
        add_to_err_log("f_max must be bigger than f_min!"); return;
    }
    if (f_max > (sample_rate/2))
    {
        add_to_err_log("f_max cannot exceed half sample rate !"); return;
    }
    var sample_period = 1/sample_rate;
    var samples_per_sin_period = sample_rate/sine_freq;
    var samples_per_fm_period = sample_rate/((f_max + f_min)/2);
    var fm_cycles_per_sin_period = samples_per_sin_period/samples_per_fm_period;
    var total_pwm_cycles = total_samples / samples_per_fm_period;
    var delta_a = (360*Math.PI/180) / fm_cycles_per_sin_period;
    var i;
    var f;
    var a = start_angle;

    for (i = 0; i < total_pwm_cycles; i++)
    {
        f = f_min + ((f_max - f_min)/2) + ((f_max - f_min)*Math.sin(a)*0.5)
        add_cycle(target_channel,0.5,(sample_rate/f));
        a += delta_a;
    }
}
