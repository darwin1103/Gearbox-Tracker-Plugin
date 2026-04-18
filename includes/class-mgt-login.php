<?php
if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

class MGT_Login {

	public static function init() {
		add_action( 'login_enqueue_scripts', array( __CLASS__, 'enqueue_login_styles' ) );
		add_filter( 'login_headerurl', array( __CLASS__, 'custom_login_logo_url' ) );
		add_filter( 'login_message', array( __CLASS__, 'custom_login_message' ) );
	}

	public static function enqueue_login_styles() {
		wp_enqueue_style( 'google-fonts-barlow', 'https://fonts.googleapis.com/css2?family=Barlow+Condensed:wght@400;500;600;700&family=Barlow:wght@300;400;500&display=swap', array(), null );
		wp_enqueue_style( 'mgt-login-style', MGT_PLUGIN_URL . 'assets/css/login-style.css', array(), MGT_VERSION );
	}

	public static function custom_login_logo_url() {
		return home_url();
	}

	public static function custom_login_message( $message ) {
		$custom_logo = '<div class="mgt-login-logo">MAYDAY <span>GEARBOX REPAIR</span><div class="mgt-login-sub">Industrial Repair Management Portal</div></div>';
		return $custom_logo . $message;
	}
}
