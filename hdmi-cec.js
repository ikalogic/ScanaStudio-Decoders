var ch;
var baud;
var inter_transaction_silence_us;
var spb;
	
function build_signals() 
{
	/*
		Configuration part : !! Configure this part !!
		(Do not change variables names)
	*/
	
	ch = 0; 				// The channel on wich signal are genrated
	baud = 1/0.0024;		// The baudrate of the communication (usualy 416bps)
	var initiator =	0x2;	//	@ of the sender (4bits)
	var follower =	0xA;	//	@ of the receiver (4bits) (0xF to broadcast)
	var data_str =	"Hey";		//	data transmitted
	
	inter_transaction_silence_us = 500;	//time in µs spend between two packet of the frame
	
	/*#################### DO NOT CHANGE CODE UNDER THIS LINE ####################*/
	spb=get_sample_rate()/baud;
	
	start_bit();
	var header=initiator*16+follower;
	data_str = String.fromCharCode(header) + data_str;
	write_str(data_str);
	standby_us(5000);
} 

function standby_us(t_us)
{
	add_samples(ch,1,t_us*get_sample_rate()/1000000);
}

function start_bit()
{
	standby_us(inter_transaction_silence_us);
	add_samples(ch,0,spb*37/24);
	add_samples(ch,1,spb*8/24);
}

function data_high()
{
	add_samples(ch,0,spb*6/24);
	add_samples(ch,1,spb*18/24);
}

function data_low()
{
	add_samples(ch,0,spb*15/24);
	add_samples(ch,1,spb*9/24);
}

function write_byte(data)
{
	var i=0;
	var bit_t = [];
	
	for(i=7;i>=0;i--)
	{
		bit_t[i]=data % 2;
		data=(data-bit_t[i])/2;
	}
	
	for(i=0;i<8;i++)
	{
		if (bit_t[i]==1)
			data_high();
		else
			data_low();
	}
}

function write_str(str)
{
	var i;
	for(i=0;i<str.length;i++)
	{
		write_byte(str.charCodeAt(i));
		if (i!=str.length-1)
			data_low();		//EOM
		else
			data_high();	//EOM
		data_high();		//ACK
		
		standby_us(inter_transaction_silence_us);
	}
}
