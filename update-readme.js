// File: update-readme.js

import { Octokit } from '@octokit/rest';
import fs from 'fs';

const octokit = new Octokit({
  auth: process.env.GITHUB_TOKEN,
});

const username = process.env.USERNAME || 'MrBytes10';

async function getRecentActivity() {
  try {
    const events = await octokit.rest.activity.listPublicEventsForUser({
      username: username,
      per_page: 10,
    });

    const activityItems = events.data.slice(0, 5).map(event => {
      const date = new Date(event.created_at).toLocaleDateString('en-US');
      const repo = event.repo.name;
      
      switch (event.type) {
        case 'PushEvent':
          const commits = event.payload.commits?.length || 1;
          return `🔥 Pushed ${commits} commit${commits > 1 ? 's' : ''} to **${repo}** - ${date}`;
        case 'PullRequestEvent':
          const action = event.payload.action;
          return `🔀 ${action === 'opened' ? 'Opened' : 'Updated'} pull request in **${repo}** - ${date}`;
        case 'IssuesEvent':
          return `🐛 ${event.payload.action === 'opened' ? 'Opened' : 'Updated'} issue in **${repo}** - ${date}`;
        case 'ForkEvent':
          return `🍴 Forked **${repo}** - ${date}`;
        case 'CreateEvent':
          return `✨ Created ${event.payload.ref_type} in **${repo}** - ${date}`;
        case 'WatchEvent':
          return `⭐ Starred **${repo}** - ${date}`;
        default:
          return `📝 Activity in **${repo}** - ${date}`;
      }
    });

    return activityItems.length > 0 ? activityItems.join('\n') : '🔄 No recent activity found';
  } catch (error) {
    console.error('Error fetching activity:', error.message);
    return '❌ Unable to fetch recent activity';
  }
}

async function getAccurateGitHubStats() {
  try {
    console.log('📊 Fetching accurate GitHub statistics...');
    
    const { data: user } = await octokit.rest.users.getByUsername({ username });
    const { data: repos } = await octokit.paginate(octokit.rest.repos.listForUser, {
        username: username,
        type: 'owner',
        per_page: 100,
    });

    const totalStars = repos.reduce((sum, repo) => sum + repo.stargazers_count, 0);
    const totalForks = repos.reduce((sum, repo) => sum + repo.forks_count, 0);
    const totalWatchers = repos.reduce((sum, repo) => sum + repo.watchers_count, 0);

    const now = new Date();
    const sixMonthsAgo = new Date(now);
    sixMonthsAgo.setMonth(now.getMonth() - 6);
    const oneMonthAgo = new Date(now);
    oneMonthAgo.setMonth(now.getMonth() - 1);
    const oneWeekAgo = new Date(now);
    oneWeekAgo.setDate(now.getDate() - 7);
    
    let totalCommits = 0;
    let recentCommits6Months = 0;
    let recentCommits1Month = 0;
    let recentCommits1Week = 0;
    let languageStats = {};
    let languageBytes = {};
    let activeRepos = 0;
    let recentlyUpdatedRepos = 0;

    const commitPromises = repos.map(async (repo) => {
        try {
            const languages = await octokit.rest.repos.listLanguages({
                owner: username,
                repo: repo.name,
            });

            Object.entries(languages.data).forEach(([lang, bytes]) => {
                languageBytes[lang] = (languageBytes[lang] || 0) + bytes;
                languageStats[lang] = (languageStats[lang] || 0) + 1;
            });

            const commits = await octokit.paginate(octokit.rest.repos.listCommits, {
                owner: username,
                repo: repo.name,
                author: username,
                since: sixMonthsAgo.toISOString(),
            });

            totalCommits += commits.length;
            if (commits.length > 0) activeRepos++;

            commits.forEach(commit => {
                const commitDate = new Date(commit.commit.author.date);
                if (commitDate > oneMonthAgo) recentCommits1Month++;
                if (commitDate > oneWeekAgo) recentCommits1Week++;
            });
            
            const lastUpdate = new Date(repo.updated_at);
            if (lastUpdate > oneMonthAgo) recentlyUpdatedRepos++;
        } catch (error) {
            console.log(`Skipping repo ${repo.name}: ${error.message}`);
        }
    });

    await Promise.all(commitPromises);
    recentCommits6Months = totalCommits; // All fetched commits are within the last 6 months

    const totalBytes = Object.values(languageBytes).reduce((sum, bytes) => sum + bytes, 0);
    const topLanguagesByBytes = Object.entries(languageBytes)
      .sort(([,a], [,b]) => b - a)
      .slice(0, 5)
      .map(([lang, bytes]) => `${lang}: ${((bytes / totalBytes) * 100).toFixed(1)}%`);

    const totalLanguageRepos = Object.values(languageStats).reduce((sum, count) => sum + count, 0);
    const topLanguagesByRepos = Object.entries(languageStats)
      .sort(([,a], [,b]) => b - a)
      .slice(0, 5)
      .map(([lang, count]) => `${lang}: ${((count / repos.length) * 100).toFixed(1)}%`);

    return {
      totalRepos: user.public_repos,
      totalStars,
      totalForks,
      totalWatchers,
      followers: user.followers,
      following: user.following,
      publicGists: user.public_gists,
      totalCommits,
      recentCommits6Months,
      recentCommits1Month,
      recentCommits1Week,
      activeRepos,
      recentlyUpdatedRepos,
      topLanguagesByBytes,
      topLanguagesByRepos,
      accountCreated: new Date(user.created_at).getFullYear(),
    };
  } catch (error) {
    console.error('Error fetching accurate stats:', error);
    return null;
  }
}

async function getLatestProjects() {
    try {
      const { data: repos } = await octokit.rest.repos.listForUser({
        username: username,
        sort: 'pushed', // Sort by most recently pushed to
        per_page: 5,
      });
  
      const projectItems = repos.map(repo => {
        const language = repo.language ? `\`${repo.language}\`` : '';
        const description = repo.description ? `- ${repo.description}` : '';
        return `🚀 **[${repo.name}](${repo.html_url})** ${language} ${description}\n   📅 Last updated: ${new Date(repo.pushed_at).toLocaleDateString('en-US')}`;
      });
  
      return projectItems.join('\n');
    } catch (error) {
      console.error('Error fetching latest projects:', error.message);
      return '❌ Unable to fetch latest projects';
    }
  }

async function updateReadme() {
  try {
    console.log('🚀 Starting enhanced README update...');
    let readme = fs.readFileSync('README.md', 'utf8');

    const stats = await getAccurateGitHubStats();
    if (stats) {
        const contributionSummary = `📊 **${stats.totalRepos}** repositories | ⭐ **${stats.totalStars}** stars received | 🍴 **${stats.totalForks}** forks | 👥 **${stats.followers}** followers | 🔥 **${stats.recentCommits1Month}** commits (last month) | 📈 **${stats.activeRepos}** active repos`;
        readme = readme.replace(/<!-- CONTRIBUTION_SUMMARY:START -->[\s\S]*?<!-- CONTRIBUTION_SUMMARY:END -->/, `<!-- CONTRIBUTION_SUMMARY:START -->\n${contributionSummary}\n<!-- CONTRIBUTION_SUMMARY:END -->`);
        
        const currentYear = new Date().getFullYear();
        const accountAge = currentYear - stats.accountCreated;
        const currentDate = new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
        const currentTime = new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', timeZoneName: 'short' });

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
- **Active Repositories (last 6 months):** ${stats.activeRepos} out of ${stats.totalRepos}
- **Recently Pushed Repos (last month):** ${stats.recentlyUpdatedRepos}

### 💻 Language Distribution (by code volume)
${stats.topLanguagesByBytes.map(lang => `- ${lang}`).join('\n')}

### 📈 Language Usage (by repository count)
${stats.topLanguagesByRepos.map(lang => `- ${lang}`).join('\n')}

### 🏆 Contribution Metrics
- **Total Contributions (last 6 months):** ${stats.totalCommits}+ commits tracked
- **Repository Engagement:** ${stats.totalWatchers} watchers across all repos

---
*📅 Statistics last updated: ${currentDate} at ${currentTime}*  
*🔄 This data is fetched directly from GitHub API and updates every 6 hours*
`;
        readme = readme.replace(/<!-- REALTIME_STATS:START -->[\s\S]*?<!-- REALTIME_STATS:END -->/, `<!-- REALTIME_STATS:START -->\n${realTimeStats}\n<!-- REALTIME_STATS:END -->`);
    }

    const activity = await getRecentActivity();
    readme = readme.replace(/<!-- GITHUB_ACTIVITY:START -->[\s\S]*?<!-- GITHUB_ACTIVITY:END -->/, `<!-- GITHUB_ACTIVITY:START -->\n${activity}\n<!-- GITHUB_ACTIVITY:END -->`);

    const latestProjects = await getLatestProjects();
    readme = readme.replace(/<!-- LATEST_PROJECTS:START -->[\s\S]*?<!-- LATEST_PROJECTS:END -->/, `<!-- LATEST_PROJECTS:START -->\n${latestProjects}\n<!-- LATEST_PROJECTS:END -->`);
    
    // For simplicity, we'll keep the org activity static or you can implement it similarly
    const orgActivity = '🏢 No public organization memberships found';
    readme = readme.replace(/<!-- ORG_ACTIVITY:START -->[\s\S]*?<!-- ORG_ACTIVITY:END -->/, `<!-- ORG_ACTIVITY:START -->\n${orgActivity}\n<!-- ORG_ACTIVITY:END -->`);

    fs.writeFileSync('README.md', readme);
    console.log('✅ README updated successfully!');
  } catch (error) {
    console.error('❌ Error updating README:', error);
    process.exit(1);
  }
}

updateReadme();
