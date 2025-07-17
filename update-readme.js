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
      const date = new Date(event.created_at).toLocaleDateString();
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
    console.error('Error fetching activity:', error);
    return '❌ Unable to fetch recent activity';
  }
}

async function getContributionSummary() {
  try {
    const user = await octokit.rest.users.getByUsername({
      username: username,
    });

    const repos = await octokit.rest.repos.listForUser({
      username: username,
      sort: 'updated',
      per_page: 100,
    });

    const totalRepos = repos.data.length;
    const totalStars = repos.data.reduce((sum, repo) => sum + repo.stargazers_count, 0);
    const totalForks = repos.data.reduce((sum, repo) => sum + repo.forks_count, 0);

    return `📊 **${totalRepos}** repositories | ⭐ **${totalStars}** stars received | 🍴 **${totalForks}** forks | 👥 **${user.data.followers}** followers`;
  } catch (error) {
    console.error('Error fetching contribution summary:', error);
    return '❌ Unable to fetch contribution summary';
  }
}

async function getLatestProjects() {
  try {
    const repos = await octokit.rest.repos.listForUser({
      username: username,
      sort: 'created',
      per_page: 5,
    });

    const projectItems = repos.data.map(repo => {
      const stars = repo.stargazers_count > 0 ? `⭐ ${repo.stargazers_count}` : '';
      const language = repo.language ? `\`${repo.language}\`` : '';
      const description = repo.description ? ` - ${repo.description}` : '';
      
      return `🚀 **[${repo.name}](${repo.html_url})** ${language} ${stars}${description}`;
    });

    return projectItems.join('\n');
  } catch (error) {
    console.error('Error fetching latest projects:', error);
    return '❌ Unable to fetch latest projects';
  }
}

async function getOrganizationActivity() {
  try {
    const orgs = await octokit.rest.orgs.listForUser({
      username: username,
    });

    if (orgs.data.length === 0) {
      return '🏢 No organization memberships found';
    }

    const orgActivities = [];
    
    for (const org of orgs.data.slice(0, 3)) {
      try {
        const orgRepos = await octokit.rest.repos.listForOrg({
          org: org.login,
          sort: 'updated',
          per_page: 3,
        });

        const recentRepo = orgRepos.data[0];
        if (recentRepo) {
          orgActivities.push(`🏢 **${org.login}** - Recent work in [${recentRepo.name}](${recentRepo.html_url})`);
        }
      } catch (error) {
        // Skip orgs where we don't have access
        continue;
      }
    }

    return orgActivities.length > 0 ? orgActivities.join('\n') : '🏢 No recent organization activity';
  } catch (error) {
    console.error('Error fetching organization activity:', error);
    return '❌ Unable to fetch organization activity';
  }
}

async function updateReadme() {
  try {
    console.log('Fetching GitHub activity...');
    const activity = await getRecentActivity();
    const contributionSummary = await getContributionSummary();
    const latestProjects = await getLatestProjects();
    const orgActivity = await getOrganizationActivity();

    console.log('Reading README file...');
    let readme = fs.readFileSync('README.md', 'utf8');

    // Update activity section
    readme = readme.replace(
      /<!-- GITHUB_ACTIVITY:START -->[\s\S]*?<!-- GITHUB_ACTIVITY:END -->/,
      `<!-- GITHUB_ACTIVITY:START -->\n${activity}\n<!-- GITHUB_ACTIVITY:END -->`
    );

    // Update contribution summary
    readme = readme.replace(
      /<!-- CONTRIBUTION_SUMMARY:START -->[\s\S]*?<!-- CONTRIBUTION_SUMMARY:END -->/,
      `<!-- CONTRIBUTION_SUMMARY:START -->\n${contributionSummary}\n<!-- CONTRIBUTION_SUMMARY:END -->`
    );

    // Update latest projects
    readme = readme.replace(
      /<!-- LATEST_PROJECTS:START -->[\s\S]*?<!-- LATEST_PROJECTS:END -->/,
      `<!-- LATEST_PROJECTS:START -->\n${latestProjects}\n<!-- LATEST_PROJECTS:END -->`
    );

    // Update organization activity
    readme = readme.replace(
      /<!-- ORG_ACTIVITY:START -->[\s\S]*?<!-- ORG_ACTIVITY:END -->/,
      `<!-- ORG_ACTIVITY:START -->\n${orgActivity}\n<!-- ORG_ACTIVITY:END -->`
    );

    console.log('Writing updated README...');
    fs.writeFileSync('README.md', readme);
    console.log('README updated successfully!');
  } catch (error) {
    console.error('Error updating README:', error);
    process.exit(1);
  }
}

updateReadme();
