<?php
if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

class MGT_Login {

	public static function init() {
		// Ensure user registration is enabled in WP
		if ( ! get_option( 'users_can_register' ) ) {
			update_option( 'users_can_register', 1 );
			update_option( 'default_role', 'customer' ); // Set default role if needed
		}

		add_action( 'login_enqueue_scripts', array( __CLASS__, 'enqueue_login_styles' ) );
		add_filter( 'login_headerurl', array( __CLASS__, 'custom_login_logo_url' ) );
		add_filter( 'login_message', array( __CLASS__, 'custom_login_message' ) );
		add_action( 'login_form', array( __CLASS__, 'add_register_link' ) );
	}

	public static function add_register_link() {
		$register_url = wp_registration_url();
		echo '<p style="margin-top:15px;text-align:center;"><a href="' . esc_url( $register_url ) . '" style="color:var(--green);text-decoration:none;font-size:0.85rem;">Don\'t have an account? Register here</a></p>';
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
