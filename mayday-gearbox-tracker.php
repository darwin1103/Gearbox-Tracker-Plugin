<?php
/**
 * Plugin Name: Mayday Gearbox Tracker
 * Description: A single-page application portal for managing gearbox repair work orders and customer tracking.
 * Version: 1.2.0
 * Author URI: https://nickpackard.com/
 * Author: NP Connect
 * Text Domain: mayday-gearbox-tracker
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit; // Exit if accessed directly.
}

// Define plugin constants
define( 'MGT_PLUGIN_DIR', plugin_dir_path( __FILE__ ) );
define( 'MGT_PLUGIN_URL', plugin_dir_url( __FILE__ ) );
define( 'MGT_VERSION', '1.2.0' );

// Include core files
require_once MGT_PLUGIN_DIR . 'includes/class-mgt-cpt.php';
require_once MGT_PLUGIN_DIR . 'includes/class-mgt-roles.php';
require_once MGT_PLUGIN_DIR . 'includes/class-mgt-api.php';
require_once MGT_PLUGIN_DIR . 'includes/class-mgt-shortcodes.php';
require_once MGT_PLUGIN_DIR . 'includes/class-mgt-login.php';
require_once MGT_PLUGIN_DIR . 'includes/class-mgt-templates.php';

// Initialize the plugin
function mgt_init() {
	MGT_CPT::init();
	MGT_Roles::init();
	MGT_API::init();
	MGT_Shortcodes::init();
	MGT_Login::init();
	MGT_Templates::init();
}
add_action( 'plugins_loaded', 'mgt_init' );

// Activation hook
register_activation_hook( __FILE__, 'mgt_activate' );
function mgt_activate() {
    require_once MGT_PLUGIN_DIR . 'includes/class-mgt-cpt.php';
    require_once MGT_PLUGIN_DIR . 'includes/class-mgt-roles.php';
	MGT_CPT::register_cpt();
	MGT_Roles::add_roles();
	flush_rewrite_rules();
}

// Deactivation hook
register_deactivation_hook( __FILE__, 'mgt_deactivate' );
function mgt_deactivate() {
	flush_rewrite_rules();
}
