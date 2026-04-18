<?php
if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

class MGT_Shortcodes {

	public static function init() {
		add_shortcode( 'gearbox_portal', array( __CLASS__, 'render_portal' ) );
		add_action( 'wp_enqueue_scripts', array( __CLASS__, 'enqueue_assets' ) );
		add_action( 'template_redirect', array( __CLASS__, 'maybe_redirect_to_login' ) );
	}

	public static function enqueue_assets() {
		// Only enqueue if the shortcode is on the page. We can check the global $post
		global $post;
		if ( is_a( $post, 'WP_Post' ) && has_shortcode( $post->post_content, 'gearbox_portal' ) ) {
			wp_enqueue_style( 'google-fonts-barlow', 'https://fonts.googleapis.com/css2?family=Barlow+Condensed:wght@400;500;600;700&family=Barlow:wght@300;400;500&display=swap', array(), null );
			wp_enqueue_style( 'mgt-style', MGT_PLUGIN_URL . 'assets/css/style.css', array(), MGT_VERSION );
			
			wp_enqueue_script( 'mgt-app', MGT_PLUGIN_URL . 'assets/js/app.js', array( 'jquery' ), MGT_VERSION, true );
			
			// Pass data to JS
			$user = wp_get_current_user();
			$role = 'customer';
			if ( in_array( 'shop_manager', (array) $user->roles ) || in_array( 'administrator', (array) $user->roles ) ) {
				$role = 'admin';
			}
			$is_administrator = in_array( 'administrator', (array) $user->roles );

			wp_localize_script( 'mgt-app', 'mgtData', array(
				'restUrl'         => esc_url_raw( rest_url( 'gearbox/v1/' ) ),
				'nonce'           => wp_create_nonce( 'wp_rest' ),
				'userEmail'       => $user->user_email,
				'userName'        => $user->display_name,
				'userRole'        => $role,
				'isAdministrator' => $is_administrator,
				'logoutUrl'       => wp_logout_url( home_url() ),
				'adminUrl'        => admin_url(),
			) );
		}
	}

	/**
	 * Redirect unauthenticated users to the login page if they are
	 * visiting a page that contains the [gearbox_portal] shortcode.
	 * Runs on template_redirect before any output is sent.
	 */
	public static function maybe_redirect_to_login() {
		if ( is_user_logged_in() ) {
			return;
		}
		global $post;
		if ( is_a( $post, 'WP_Post' ) && has_shortcode( $post->post_content, 'gearbox_portal' ) ) {
			wp_redirect( wp_login_url( get_permalink() ) );
			exit;
		}
	}

	public static function render_portal( $atts ) {
		// By the time we get here, template_redirect has already handled
		// the redirect for unauthenticated users, so this is always logged-in.
		if ( ! is_user_logged_in() ) {
			return ''; // Fallback safety
		}

		ob_start();
		?>
		<div id="mgt-root">
			<!-- The JS will render the HTML here -->
			<div style="text-align: center; padding: 3rem; color: #6b7570;">
				Loading Portal...
			</div>
		</div>
		<?php
		return ob_get_clean();
	}
}
