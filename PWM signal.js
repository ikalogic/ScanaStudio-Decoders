/*
*************************************************************************************

							SCANASTUDIO 2 DECODER

The following commented block allows some related informations to be displayed online

<DESCRIPTION>

	Simple script to help generating PWM signals

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
	return "PWM signals";
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
	var target_channel = 0;
	var pwm_max = 0.95;
	var pwm_min = 0.05;
	var start_angle = 90*Math.PI/180; //start angle in radians
    var mod_freq = 1000;	//1 KHz
    var pwm_freq = 20000; //20 KHz

    // Some sanity checks first
    if (pwm_max <= pwm_min)
    {
        add_to_err_log("f_max must be bigger than f_min!"); return;
    }
    if (pwm_max > (sample_rate/2))
    {
        add_to_err_log("f_max cannot exceed half sample rate !"); return;
    }

    //generate sine modulated PWM on channel 1
    build_pwm_sine_modulated(0,pwm_max,pwm_min,start_angle,mod_freq,pwm_freq);
    build_pwm_sawtooth_modulated(1,pwm_max,pwm_min,start_angle,mod_freq,pwm_freq);
}

//Sine modulated PWM signal
function build_pwm_sine_modulated(target_channel,pwm_max,pwm_min,start_angle,sine_freq,pwm_freq) {
	var sample_rate = get_sample_rate();
	var total_samples = get_maximum_samples();	
	var sample_period = 1/sample_rate;
	var samples_per_sin_period = sample_rate/sine_freq;
	var samples_per_pwm_period = sample_rate/pwm_freq;
	var pwm_cycles_per_sin_period = samples_per_sin_period/samples_per_pwm_period;
	var total_pwm_cycles = total_samples / samples_per_pwm_period;
	var delta_a = (360*Math.PI/180) / pwm_cycles_per_sin_period;
	var i;
	var duty;
	var a = start_angle;

	for (i = 0; i < total_pwm_cycles; i++)
	{
		duty = pwm_min + ((pwm_max - pwm_min)/2) + ((pwm_max - pwm_min)*Math.sin(a)*0.5)
		add_cycle(target_channel,duty,samples_per_pwm_period);
		a+= delta_a;
	}
}

//Saw Tooth modulated PWM signal template
function build_pwm_sawtooth_modulated(target_channel,pwm_max,pwm_min,start_angle,saw_freq,pwm_freq) {
		
	//start of the generator script
	var sample_rate = get_sample_rate();
	var total_samples = get_maximum_samples();	
	var sample_period = 1/sample_rate;
	var samples_per_saw_period = sample_rate/saw_freq;
	var samples_per_pwm_period = sample_rate/pwm_freq;
	var pwm_cycles_per_saw_period = samples_per_saw_period/samples_per_pwm_period;
	var total_pwm_cycles = total_samples / samples_per_pwm_period;
	var delta_pwm = (pwm_max-pwm_min) / pwm_cycles_per_saw_period;
	var i;
	var duty = pwm_min;
    duty = pwm_min + ((pwm_max - pwm_min)/2) + ((pwm_max - pwm_min)*Math.sin(start_angle)*0.5)

	for (i = 0; i < total_pwm_cycles; i++)
	{
		add_cycle(target_channel,duty,samples_per_pwm_period);
		duty += delta_pwm;
		if (duty > pwm_max) duty = pwm_min;
	}
}