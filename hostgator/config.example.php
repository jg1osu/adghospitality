<?php
/**
 * COPY THIS FILE OUTSIDE public_html as /home/YOUR_ACCOUNT/adg-inquiry-config.php.
 * The endpoint never loads this example automatically. Keep private settings out
 * of the website source / public uploads. Restrict the private file to 0600.
 * If stored elsewhere, set server env ADG_INQUIRY_CONFIG_PATH to its absolute path.
 * No Resend API key is needed for the PHP alternative; HostGator handles mail().
 */
return [
    'to_email' => 'alisa@adghospitality.com',
    // Create this domain mailbox and configure SPF/DKIM in cPanel before going live.
    'from_email' => 'website@adghospitality.com',
    // Set your exact HTTPS domain when known. Empty uses the current request host.
    'site_origin' => '',
    // Recommended: a private writable directory for 24-hour retry deduplication.
    // mkdir -m 700 /home/YOUR_ACCOUNT/adg-inquiry-state
    // Then set: 'state_dir' => __DIR__ . '/adg-inquiry-state',
    // Only a request hash and acceptance timestamp are stored; no inquiry data.
    'state_dir' => '',
];
