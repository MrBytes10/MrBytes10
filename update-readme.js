// File: update-readme.js

import { Octokit } from '@octokit/rest';
import fs from 'fs';

const octokit = new Octokit({
  auth: process.env.GITHUB_TOKEN,
});

const username = process.env.USERNAME || 'MrBytes10';

// Get the WakaTime API key from environment variables
const wakaApiKey = process.env.WAKATIME_API_KEY;

// *** NEW FUNCTION TO GET WAKATIME STATS ***
async function getWakaTimeStats() {
  if (!wakaApiKey) {
    console.warn('WakaTime API Key not found. Skipping WakaTime stats.');
    return 'WakaTime API Key not set. Could not fetch stats.';
  }
  try {
    const response = await fetch(`https://wakatime.com/api/v1/users/current/stats/last_7_days?api_key=${wakaApiKey}`);
    if (!response.ok) {
        throw new Error(`WakaTime API response not OK: ${response.statusText}`);
    }
    const stats = await response.json();
    const topLanguages = stats.data.languages
      .slice(0, 5) // Get top 5 languages
      .map(lang => `- ${lang.name}: ${lang.text} (${lang.percent}%)`)
      .join('\n');

    return `**💻 Coding Activity (Last 7 Days)**\n\n${topLanguages}`;
  } catch (error) {
    console.error(`Error fetching WakaTime stats: ${error.message}`);
    return '❌ Could not retrieve WakaTime stats.';
  }
}

// This function fetches recent public events. It's working correctly.
async function getRecentActivity() {
  try {
    const events = await octokit.rest.activity.listPublicEventsForUser({
      username: username,
      per_page: 5,
    });
    const activityItems = events.data.map(event => {
      const date = new Date(event.created_at).toLocaleDateString('en-US');
      const repo = event.repo.name;
      switch (event.type) {
        case 'PushEvent':
          const commits = event.payload.commits?.length || 1;
          return `🔥 Pushed ${commits} commit${commits > 1 ? 's' : ''} to **${repo}** - ${date}`;
        case 'PullRequestEvent':
          return `🔀 ${event.payload.action === 'opened' ? 'Opened' : 'Updated'} pull request in **${repo}** - ${date}`;
        default:
          return `📝 Other activity in **${repo}** - ${date}`;
      }
    });
    return activityItems.join('\n');
  } catch (error) {
    console.error(`Error fetching activity: ${error.message}`);
    return '❌ Unable to fetch recent activity';
  }
}

// This is the rewritten, more robust function.
async function getAccurateGitHubStats() {
  try {
    console.log('📊 Fetching accurate GitHub statistics...');
    const { data: user } = await octokit.rest.users.getByUsername({ username });
    const repos = await octokit.paginate(octokit.rest.repos.listForUser, {
        username: username,
        type: 'owner',
        per_page: 100,
    });

    let totalStars = 0;
    let totalForks = 0;
    let languageBytes = {};
    let recentCommits6Months = 0;
    let recentCommits1Month = 0;
    let recentCommits1Week = 0;
    let activeReposCount = 0;

    const sixMonthsAgo = new Date();
    sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);

    for (const repo of repos) {
        // THE FIX: Skip empty repositories to prevent API errors
        if (repo.size === 0) {
            console.log(`- Skipping empty repository: ${repo.name}`);
            continue;
        }

        totalStars += repo.stargazers_count;
        totalForks += repo.forks_count;

        try {
            // Count languages
            const languages = await octokit.rest.repos.listLanguages({ owner: username, repo: repo.name });
            for (const [lang, bytes] of Object.entries(languages.data)) {
                languageBytes[lang] = (languageBytes[lang] || 0) + bytes;
            }

            // Count commits in the last 6 months
            const commits = await octokit.paginate(octokit.rest.repos.listCommits, {
                owner: username,
                repo: repo.name,
                author: username,
                since: sixMonthsAgo.toISOString(),
            });

            if (commits.length > 0) {
                activeReposCount++;
                const now = new Date();
                const oneMonthAgo = new Date().setMonth(now.getMonth() - 1);
                const oneWeekAgo = new Date().setDate(now.getDate() - 7);

                recentCommits6Months += commits.length;
                for (const commit of commits) {
                    const commitDate = new Date(commit.commit.author.date);
                    if (commitDate > oneMonthAgo) recentCommits1Month++;
                    if (commitDate > oneWeekAgo) recentCommits1Week++;
                }
            }
        } catch (error) {
            console.log(`- Could not process repo ${repo.name}: ${error.message}. Skipping.`);
        }
    }

    const totalBytes = Object.values(languageBytes).reduce((sum, bytes) => sum + bytes, 0);
    const topLanguagesByBytes = Object.entries(languageBytes)
      .sort(([,a], [,b]) => b - a)
      .slice(0, 5)
      .map(([lang, bytes]) => `${lang}: ${((bytes / totalBytes) * 100).toFixed(1)}%`);

    return {
      totalRepos: user.public_repos,
      totalStars,
      totalForks,
      followers: user.followers,
      following: user.following,
      publicGists: user.public_gists,
      accountCreated: new Date(user.created_at).getFullYear(),
      recentCommits6Months,
      recentCommits1Month,
      recentCommits1Week,
      activeReposCount,
      topLanguagesByBytes,
    };
  } catch (error) {
    console.error(`❌ Major error in getAccurateGitHubStats: ${error.message}`);
    return null; // Ensure it returns null on major failure
  }
}

async function getLatestProjects() {
    try {
      const { data: repos } = await octokit.rest.repos.listForUser({
        username: username,
        sort: 'pushed',
        per_page: 5,
      });
      return repos.map(repo => 
        `🚀 **[${repo.name}](${repo.html_url})** ${repo.language ? `\`${repo.language}\`` : ''} ${repo.description ? `- ${repo.description}` : ''}\n   📅 Last updated: ${new Date(repo.pushed_at).toLocaleDateString('en-US')}`
      ).join('\n');
    } catch (error) {
      console.error(`Error fetching latest projects: ${error.message}`);
      return '❌ Unable to fetch latest projects';
    }
}

async function updateReadme() {
  console.log('🚀 Starting enhanced README update...');
  let readme = fs.readFileSync('README.md', 'utf8');

   // Fetch all data in parallel for speed
  const [stats, activity, latestProjects, wakaStats] = await Promise.all([
    getAccurateGitHubStats(),
    getRecentActivity(),
    getLatestProjects(),
    getWakaTimeStats() // Fetch WakaTime data
  ]);

  const stats = await getAccurateGitHubStats();
  
  // This is the critical block that was being skipped.
 // Update GitHub Stats sections
  if (stats) {
    console.log('✅ GitHub stats fetched. Updating sections...');
    const contributionSummary = `📊 **${stats.totalRepos}** repositories | ⭐ **${stats.totalStars}** stars received | 🍴 **${stats.totalForks}** forks | 👥 **${stats.followers}** followers | 🔥 **${stats.recentCommits1Month}** commits (last month) | 📈 **${stats.activeReposCount}** active repos`;
    readme = readme.replace(/<!-- CONTRIBUTION_SUMMARY:START -->[\s\S]*?<!-- CONTRIBUTION_SUMMARY:END -->/, `<!-- CONTRIBUTION_SUMMARY:START -->\n${contributionSummary}\n<!-- CONTRIBUTION_SUMMARY:END -->`);
    
    const accountAge = new Date().getFullYear() - stats.accountCreated;
    const currentDate = new Date().toLocaleDateString('en-US', { dateStyle: 'long' });
    const realTimeStats = `
## 📊 Real-Time GitHub Statistics
### 🎯 Profile Overview
- **Total Repositories:** ${stats.totalRepos}
- **Total Stars Earned:** ${stats.totalStars} ⭐
- **Total Forks:** ${stats.totalForks} 🍴
- **Followers:** ${stats.followers} 👥
- **Following:** ${stats.following} 👥
- **Public Gists:** ${stats.publicGists} 📝
- **Account Age:** ${accountAge} years (since ${stats.accountCreated})
### 🔥 Contribution Activity
- **Last Week:** ${stats.recentCommits1Week} commits
- **Last Month:** ${stats.recentCommits1Month} commits
- **Last 6 Months:** ${stats.recentCommits6Months} commits
### 💻 Language Distribution (by code volume)
${stats.topLanguagesByBytes.map(lang => `- ${lang}`).join('\n')}
---
*📅 Statistics last updated: ${currentDate}*`;
    readme = readme.replace(/<!-- REALTIME_STATS:START -->[\s\S]*?<!-- REALTIME_STATS:END -->/, `<!-- REALTIME_STATS:START -->\n${realTimeStats}\n<!-- REALTIME_STATS:END -->`);
  }

  // Update other sections
  console.log('✅ Other data fetched. Updating sections...');
  readme = readme.replace(/<!-- GITHUB_ACTIVITY:START -->[\s\S]*?<!-- GITHUB_ACTIVITY:END -->/, `<!-- GITHUB_ACTIVITY:START -->\n${activity}\n<!-- GITHUB_ACTIVITY:END -->`);
  readme = readme.replace(/<!-- LATEST_PROJECTS:START -->[\s\S]*?<!-- LATEST_PROJECTS:END -->/, `<!-- LATEST_PROJECTS:START -->\n${latestProjects}\n<!-- LATEST_PROJECTS:END -->`);
  
  // Update WakaTime section
  readme = readme.replace(/<!-- WAKATIME_STATS:START -->[\s\S]*?<!-- WAKATIME_STATS:END -->/, `<!-- WAKATIME_STATS:START -->\n${wakaStats}\n<!-- WAKATIME_STATS:END -->`);

  fs.writeFileSync('README.md', readme);
  console.log('✅ README update process finished!');
}

updateReadme();
