<?php
/**
 * Template Name: Mayday Gearbox Portal (Full Width)
 * Description: A full-width template with no header or footer, designed specifically for the Gearbox Tracker SPA.
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

// Setup basic HTML skeleton
?>
<!DOCTYPE html>
<html <?php language_attributes(); ?>>
<head>
	<meta charset="<?php bloginfo( 'charset' ); ?>">
	<meta name="viewport" content="width=device-width, initial-scale=1">
	<title><?php wp_title( '|', true, 'right' ); ?></title>
	<?php wp_head(); ?>
	<style>
		/* Ensure absolutely no margins, padding, or theme interference */
		html, body {
			margin: 0 !important;
			padding: 0 !important;
			width: 100%;
			min-height: 100vh;
			background: #0d0f0e; /* Fallback for smooth scroll background */
		}
		
		/* Force hide the admin bar and remove its injected top margin */
		#wpadminbar {
			display: none !important;
		}
		html {
			margin-top: 0 !important;
		}
	</style>
</head>
<body <?php body_class(); ?>>
	<?php
	// Output the post content (which should contain the shortcode)
	while ( have_posts() ) :
		the_post();
		the_content();
	endwhile;
	
	wp_footer();
	?>
</body>
</html>
