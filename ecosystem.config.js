module.exports = {
	apps: [
		{
			name: 'LogWatcher',
			script: './src/LogWatcher.js',
			args: '',
			cwd: '.',
			log_date_format: 'YYYY-MM-DD HH:mm:ss.SSS',
			error_file: 'logs/LogWatcher_err.log',
			out_file: 'logs/LogWatcher_out.log',
		}
	]
};
