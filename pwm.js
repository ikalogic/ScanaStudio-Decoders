
/*
*************************************************************************************

						  SCANASTUDIO 2 PWM DECODER

The following commented block allows some related informations to be displayed online

<DESCRIPTION>

	PWM Decoder.
	A decoder of pulse-width modulation, or pulse-duration modulation signal.

</DESCRIPTION>

<RELEASE_NOTES>

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
	return "PWM";
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
	return "IKALOGIC";
}


/* Graphical user interface for this decoder
*/
function gui()
{
	ui_clear();
	ui_add_ch_selector("chPwm", "PWM Line", "PWM");

	ui_add_txt_combo("uiDispFormat", "Duty Cycle Display Format");
		ui_add_item_to_txt_combo("0 to 1");
		ui_add_item_to_txt_combo("0% to 100%", true);

	ui_add_txt_combo("uiDispOpt", "Result Display on");
		ui_add_item_to_txt_combo("Active State");
		ui_add_item_to_txt_combo("Period", true);
}


/* This is the function that will be called from ScanaStudio
   to update the decoded items
*/
function decode()
{
	get_ui_vals();
	clear_dec_items();

	var trPwm = trs_get_first(chPwm);
	var trPwmPrev = 0;
	var trPwmMid = 0;

	while ((trs_is_not_last(chPwm) != false))
	{
		if (abort_requested() == true)
		{
			return;
		}

		set_progress(100 * trPwm.sample / n_samples);

		trPwmPrev = trPwm;
		trPwmMid = trs_get_next(chPwm);
		trPwm = trs_get_next(chPwm);

		var tPeriod = trPwm.sample - trPwmPrev.sample;
		var tHigh = 0;

		if (trPwmMid.val == 1)
		{
			tHigh = trPwm.sample - trPwmMid.sample;

			if (uiDispOpt < 1)
			{
				dec_item_new(chPwm, trPwmMid.sample,  trPwm.sample);
			}
		}
		else
		{
			tHigh = trPwmMid.sample - trPwmPrev.sample;
			
			if (uiDispOpt < 1)
			{
				dec_item_new(chPwm, trPwmPrev.sample, trPwmMid.sample);
			}
		}

		var duty = (tHigh / tPeriod);
		duty = duty.toFixed(2);

		var dutyNum = duty;

		if (uiDispFormat > 0)
		{
			duty = duty * 100;
			dutyNum = duty;
			duty = duty + "%";
		}

		if (uiDispOpt > 0)
		{
			dec_item_new(chPwm, trPwmPrev.sample + (tPeriod / 20),  trPwm.sample - (tPeriod / 20));
		}

		dec_item_add_pre_text(duty);
		dec_item_add_comment(duty);
	}

	return true;
}
