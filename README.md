# Home Assistant Version Control Beta

**Automatic backup, history tracking, and instant restore for your Home Assistant configuration.**

Home Assistant Version Control acts as a "time machine" for your setup. It automatically tracks every change to your YAML configuration files using a robust local Git backend. Browse your history, visualize diffs, and restore individual files or your entire configuration to any previous state with a single click.

> [!IMPORTANT]
> 1.  **Existing Git Repos:** If you already have a `.git` folder in your `/config` directory, **back it up and possibly delete it** before starting this add-on. This add-on manages its own internal Git repository and may conflict with existing ones.
> 2.  **Backup Strategy:** While this add-on provides excellent version control, **do not rely on it as your sole backup method**. Always maintain external backups (e.g., Google Drive, Samba) of your Home Assistant instance.

---

##  Key Features

###  Automatic & Smart Tracking
* **Zero-Effort Backups:** Every edit is saved automatically.
* **Smart Debouncing:** Multiple rapid edits are grouped into a single save snapshot (customizable delay).
* **Comprehensive Tracking:** Monitors `.yaml`, `.yml`, and `lovelace` dashboard files (both UI and YAML mode).
* **Efficient Storage:** Uses Git deduplication to minimize disk usage.

###  Timeline & History
* **Chronological Feed:** View changes grouped by "Today," "Yesterday," and "Earlier."
* **Visual Diffs:** Compare the current version against any backup side-by-side. Additions are highlighted in **green**, deletions in **red**.
* **History Management:** Automatically merges and prunes older snapshots to keep your history clean based on your retention settings.

###  Instant Restore
* **Granular Control:** Restore specific files or revert your entire configuration.
* **Smart Reloads:** Automatically reloads Home Assistant when restoring automation or script files to apply changes immediately.
* **"Time Travel":** Long-press the restore button to revert the entire system to a previous point in time.

###  Customization
* **Accent Colors:** Choose from seven preset color palettes.
* **Themes:** Toggle between Light and Dark modes.
* **Diff Viewer:** Customize your diff experience with 8 different styles (High Contrast, GitHub Classic, Neon, etc.) and choose between Unified or Side-by-Side views.



• Accent Colors: Pick from seven curated color palettes.
• Themes: Switch instantly between Light and Dark.
• Diff Viewer: Choose from eight diff styles (High Contrast, GitHub Classic, Neon, and more) and view changes in Unified or Side-by-Side mode.

---

## Installation

There are two ways to install Home Assistant Version Control: as a Home Assistant add-on or as a standalone Docker container.

### 1. Home Assistant Add-on (Recommended for most users)

1.  **Add Repository:**
    Click the button below to add the repository to your Home Assistant instance:

    [![Open your Home Assistant instance and show the add-on store](https://my.home-assistant.io/badges/supervisor_add_addon_repository.svg)](https://my.home-assistant.io/redirect/supervisor_add_addon_repository/?repository_url=https://github.com/saihgupr/HomeAssistantVersionControlBeta)

    **Or manually add it:**
    - Navigate to **Settings** → **Add-ons** → **Add-on Store**
    - Click the three dots (⋮) in the top right corner and select **Repositories**
    - Add the repository URL:
      ```
      https://github.com/saihgupr/HomeAssistantVersionControlBeta
      ```

2.  **Install the Add-on:**
    The "Home Assistant Version Control Beta" add-on will now appear in the store. Click on it and then click "Install".

3.  **Start:** Start the add-on and click **"Open Web UI"** to access the interface.

4.  **Optional (External Access):** To access the UI externally at port `54001`, enable the port in the add-on's **Configuration** tab (disabled by default).

### 2. Standalone Docker Installation

For Docker users who aren't using the Home Assistant add-on, you have three deployment options:

**Option A: Docker Compose (recommended):**

1. Download the docker-compose.yml file:
   ```bash
   curl -o docker-compose.yml https://raw.githubusercontent.com/saihgupr/HomeAssistantVersionControlBeta/main/docker-compose.yml
   ```

2. Edit the file to set your paths and timezone:
   ```bash
   nano docker-compose.yml
   # Update the volume path: /path/to/your/ha/config
   # Update timezone: TZ environment variable (e.g., America/New_York)
   ```

3. Start the service:
   ```bash
   docker compose up -d
   ```

Access the interface at `http://localhost:54001`.

**Option B: Docker Run (pre-built image):**

```bash
docker run -d \
  -p 54001:54001 \
  -v /path/to/your/config:/config \
  -e TZ=America/New_York \
  --name home-assistant-version-control \
  ghcr.io/saihgupr/homeassistantversioncontrolbeta:latest
```

Replace `/path/to/your/config` with the actual path to your Home Assistant configuration directory.

**Option C: Build locally:**

```bash
git clone https://github.com/saihgupr/HomeAssistantVersionControlBeta.git
cd HomeAssistantVersionControlBeta/homeassistant-version-control
docker build --build-arg BUILD_FROM=alpine:latest -t home-assistant-version-control .

docker run -d \
  -p 54001:54001 \
  -v /path/to/your/config:/config \
  -e TZ=America/New_York \
  --name home-assistant-version-control \
  home-assistant-version-control
```

Access the interface at `http://localhost:54001`.

---



### Restore Actions
* **Restore Single File:** Click the "Restore" button on any file in the timeline.
* **Restore All Files:** Long-press (2 seconds) the "Restore" button on a timeline entry to revert **all tracked files** to that exact moment.

---

##  How It Works

### The Workflow
1.  **File Watcher:** The system continuously monitors your `/config` folder for changes to YAML files.
2.  **Stabilization:** When a change is detected, it waits **2 seconds** to ensure Home Assistant has finished writing the file (preventing corruption).
3.  **Debounce:** It then waits for your configured **Debounce Time** (default 1s) to batch related edits into a single commit.
4.  **Snapshot:** A Git commit is created with a timestamp.
5.  **Cleanup:** If enabled, old snapshots are consolidated periodically.

### What is Tracked?
The add-on automatically tracks configuration files while ignoring system files.

| Tracked ✅ | Ignored ❌ |
| :--- | :--- |
| `configuration.yaml` | Database files (`.db`, `.db-shm`) |
| `automations.yaml`, `scripts.yaml` | Log files (`*.log`) |
| `secrets.yaml` | Python cache (`__pycache__`) |
| Lovelace dashboards (`.storage/lovelace*`) | Binary files (Images, Videos) |
| `esphome/*.yaml` | Temporary files |
| All other `.yaml` and `.yml` files | |

*You can customize exclusions by editing the `.gitignore` file in your config folder.*

---

<details>
<summary><h2>API</h2></summary>

API for advanced users or automation.

| Method | Endpoint | Description |
| :--- | :--- | :--- |
| `POST` | `/api/git/add-all-and-commit` | **Manual Backup:** Forces a commit of all current changes. |
| `POST` | `/api/run-retention` | **Run Cleanup:** Manually triggers the history retention cleanup process. |
| `POST` | `/api/retention/cleanup` | **Advanced Cleanup:** Run cleanup with custom time parameters. |
| `POST` | `/api/restore-commit` | **Time Travel:** Restore ALL files to a specific point in time. |
| `POST` | `/api/restore-file` | **Restore File:** Restore a single file to a specific commit. |
| `POST` | `/api/git/hard-reset` | **Hard Reset:** Reset the repository to a specific commit (destructive). |
| `POST` | `/api/ha/restart` | **Restart HA:** Triggers a Home Assistant restart. |
| `GET` | `/api/git/history` | **Get History:** Returns the full commit history log. |
| `GET` | `/api/git/file-diff` | **File Diff:** Get the diff for a specific file in a commit. |
| `GET` | `/api/git/commit-diff` | **Commit Diff:** Get the full diff for a specific commit. |

### Endpoint Details

#### `POST /api/git/hard-reset`
Reset the repository to a specific commit. **WARNING: This is destructive and will discard all changes since that commit.**

**Parameters:**
*   `commitHash` (string, required): The full or short hash of the commit to reset to.
*   `createBackup` (boolean, optional): If `true`, creates a safety backup commit of the current state before resetting. Default: `false`.

**Example:**
```json
{
  "commitHash": "a1b2c3d4",
  "createBackup": true
}
```

#### `POST /api/restore-commit`
Restore all files to their state at a specific commit. This creates a new commit on top of the current history, preserving history.

**Parameters:**
*   `commitHash` (string, required): The hash of the commit to restore.

**Example:**
```json
{
  "commitHash": "e5f6g7h8"
}
```

#### `POST /api/restore-file`
Restore a single file to its state at a specific commit.

**Parameters:**
*   `commitHash` (string, required): The hash of the commit containing the version of the file you want.
*   `filePath` (string, required): The relative path to the file (e.g., `automations.yaml`).

**Example:**
```json
{
  "commitHash": "i9j0k1l2",
  "filePath": "scripts.yaml"
}
```

#### `POST /api/retention/cleanup`
Run the history retention cleanup process with custom parameters.

**Parameters:**
*   `days` (number, optional): Keep history for the last N days.
*   `hours` (number, optional): Keep history for the last N hours.
*   `minutes` (number, optional): Keep history for the last N minutes.
*   `months` (number, optional): Keep history for the last N months.

**Example:**
```bash
curl -X POST http://homeassistant.local:54001/api/retention/cleanup \
  -H "Content-Type: application/json" \
  -d '{"hours": 24}'
```

</details>

---

##  Support

Found a bug or have a feature request? Please [submit an issue on GitHub](https://github.com/saihgupr/HomeAssistantVersionControlBeta/issues).

**If you find this add-on helpful, please ⭐ star the repository!**