# AutoWOD

Automatically book your workout sessions using GitHub Actions! No coding knowledge required. This tool runs in the cloud and handles the booking process for you.

> **Important**: This tool is specifically designed for gyms using the [WODBuster](https://wodbuster.com/) platform. It will not work with other booking systems.

## What does this do?

- ✨ Automatically books your workout sessions on WODBuster
- 🔄 Runs daily in the cloud (using GitHub Actions)
- 🔒 Handles login and verification automatically
- ⏰ Books sessions at your preferred times
- 🆓 Completely free to use

## Before You Start

1. **Check Your Gym**: Make sure your gym uses WODBuster as their booking platform. You can verify this by checking if your gym's booking URL contains `wodbuster.com`.

2. **Terms of Service**: Please ensure you have permission from your gym to automate bookings through their WODBuster platform.

## Quick Start Guide (No Coding Required!)

1. **Fork this repository**

   - Click the "Fork" button at the top right of this page
   - This creates your own copy of the tool

2. **Set up your secrets**

   - Go to your forked repository's Settings
   - Click on "Secrets and variables" → "Actions"
   - Add these required secrets by clicking "New repository secret":

     ```
     # Authentication
     EMAIL=your-email@example.com
     PASSWORD=your-password

     # 2Captcha API Key
     TWO_CAPTCHA_API_KEY=your-2captcha-api-key

     # Target Website
     BASE_URL=https://your-gym-website.com
     ```

3. **Set your workout schedule**

   - Still in the repository secrets, add your preferred times for each day:
     ```
     # Schedule (use 24-hour format)
     MONDAY=17:00
     TUESDAY=18:30
     WEDNESDAY=09:00
     THURSDAY=19:30
     FRIDAY=20:15
     SATURDAY=14:30
     SUNDAY=14:30
     ```
   - For days you don't want to book, either:
     - Don't add the day's secret at all, or
     - Set it to an empty value
   - Use 24-hour format (e.g., '14:30' for 2:30 PM)

   **Multiple classes at the same time?** If your gym offers more than one class at the same start time (e.g. CrossFit and Endurance both at 18:00), add the class name after a `|`:
     ```
     MONDAY=18:00|CrossFit
     TUESDAY=18:00|Endurance
     ```
   The name is matched case-insensitively. If no match is found it falls back to the first available slot at that time.

4. **Optional: Configure booking window**

   ```
   # How many days in advance you can book (default: 7)
   AVAILABLE_DAYS=7
   ```

   **Gym opens the whole week at once?** If your gym releases all reservations on a single day (e.g. every Sunday), you don't need to run the script daily. Just trigger it manually from the **Actions** tab once your gym opens slots:
   1. Go to **Actions → Daily Reservation → Run workflow**
   2. Set *Days to book ahead* to however many days you want (e.g. `7`)
   3. Click **Run workflow**

   This books all the days you've configured in one shot.

5. **Get a 2Captcha API Key**

   - Go to [2captcha.com](https://2captcha.com)
   - Register an account
   - Add funds (minimum $3)
   - Copy your API key from your account dashboard

6. **Enable GitHub Actions**
   - Go to the "Actions" tab in your repository
   - Click "I understand my workflows, go ahead and enable them"

That's it! The tool will now automatically try to book your preferred sessions every day at 22:30 (winter) or 21:30 (summer) Spain time.

## Checking if it's Working

1. Go to the "Actions" tab in your repository
2. Look for the latest "Daily Reservation" workflow run
3. Click on it to see the details and logs
4. A green checkmark means it ran successfully

## Troubleshooting

### Common Issues

1. **Workflow not running?**

   - Make sure you've enabled GitHub Actions
   - Check if all required secrets are properly set

2. **Login fails?**

   - Double-check your EMAIL and PASSWORD secrets
   - Make sure your BASE_URL is correct

3. **Captcha issues?**

   - Ensure your TWO_CAPTCHA_API_KEY is correct
   - Check if you have sufficient balance on 2captcha.com

4. **Wrong booking times?**
   - Make sure you're using 24-hour format (e.g., "17:00" not "5:00 PM")
   - Check if the day's variable is set correctly (e.g., "MONDAY=17:00")

5. **Could not find Chrome error?**
   - Make sure you are using `puppeteer` (not `puppeteer-core`) in your `package.json`
   - The workflow installs Chrome automatically — do not remove the *Install Chrome for Puppeteer* step
   - If you forked this repo a long time ago, update your workflow file from the latest version of this repo

6. **Script runs but skips all days?**
   - Check that your day secrets are set and not empty (e.g. `MONDAY=18:00`)
   - The script now logs a warning at startup if no days are configured

### Need Help?

If you're having problems:

1. Check the "Issues" tab to see if others had the same problem
2. Create a new issue describing your problem
3. Include the workflow run logs (without any personal information)

## Cost Considerations

- GitHub Actions: Free for public repositories
- 2Captcha: Approximately $0.001 per booking attempt
- Estimated monthly cost: Less than $1 for daily bookings

## Safety & Privacy

- ✅ Your credentials are securely stored as GitHub secrets
- ✅ No one can see your email, password, or API keys
- ✅ The tool only accesses your gym's booking system
- ❌ Never share your secrets or API keys with anyone

## License

This project is licensed under the ISC License - see the LICENSE file for details.

## Disclaimer

This tool is specifically designed for WODBuster-powered gyms and is provided for educational purposes only. Please ensure you:

1. Have confirmed your gym uses the WODBuster platform
2. Have permission to automate interactions with your gym's WODBuster website
3. Comply with both WODBuster's and your gym's terms of service
4. Use this tool responsibly and in accordance with your gym's booking policies
