<?php
if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

class MGT_Templates {

	public static function init() {
		add_filter( 'theme_page_templates', array( __CLASS__, 'add_new_template' ) );
		add_filter( 'template_include', array( __CLASS__, 'load_template' ) );
	}

	/**
	 * Adds our template to the page dropdown for v4.7+
	 */
	public static function add_new_template( $posts_templates ) {
		$posts_templates['gearbox-portal-template.php'] = 'Mayday Gearbox Portal (Full Width)';
		return $posts_templates;
	}

	/**
	 * Checks if the template is assigned to the page
	 */
	public static function load_template( $template ) {
		global $post;

		if ( ! $post ) {
			return $template;
		}

		$page_template = get_post_meta( $post->ID, '_wp_page_template', true );

		if ( 'gearbox-portal-template.php' === $page_template ) {
			$file = MGT_PLUGIN_DIR . 'templates/gearbox-portal-template.php';
			
			if ( file_exists( $file ) ) {
				return $file;
			}
		}

		return $template;
	}
}
