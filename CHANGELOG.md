# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.0.0] - 2024-11-13

### Added
- 🎥 RTMP Server support using node-media-server
- 🌐 Multi-platform streaming support (YouTube, Twitch, Facebook, Kick)
- 🎨 Modern dark UI with responsive design
- 🔧 Web-based configuration interface
- 📊 Real-time stream statistics and status monitoring
- 🔄 Automatic stream relay using FFmpeg
- 🖥️ Electron desktop application support
- 📦 Windows installer and portable EXE builds
- 🔐 Release verification system with SHA256 checksums
- 🤖 GitHub Actions automated build and release workflow
- 📚 Comprehensive documentation (README, RELEASE_VERIFICATION)

### Features
- **Stream Management**: Single OBS stream to multiple platforms
- **Zero Quality Loss**: FFmpeg stream copying technology
- **Independent Platform Control**: Connect/disconnect platforms individually
- **Real-time Statistics**: Bitrate, FPS, resolution tracking
- **Low Resource Usage**: Optimized architecture for minimal CPU/RAM usage
- **Easy Setup**: Web-based configuration, no manual config file editing required

### Technical
- Full modular architecture with interface-driven design
- TypeScript with strict type checking
- Dependency injection pattern
- Module lifecycle management
- WebSocket real-time communication
- Express.js RESTful API

### Security
- Release verification with SHA256 checksums
- Open source codebase
- Reproducible builds
- Transparent build process via GitHub Actions

### Documentation
- Detailed README with installation and usage instructions
- Release verification guide (RELEASE_VERIFICATION.md)
- Development workflow documentation
- API documentation

## [Unreleased]

### Planned
- Auto-updater support
- System tray integration
- Notification system
- Advanced statistics dashboard
- Platform-specific optimizations

