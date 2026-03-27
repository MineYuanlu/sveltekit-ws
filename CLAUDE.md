# CLAUDE

## 发版流程

在用户提到“帮我准备发版”，即代表进入发版准备工作，得到用户明确说明更新`major/minor/patch`后：
你需要先使用`npm pkg get version`查看当前包版本，返回形如`"X.X.X"`的版本号；随后使用`git diff`查看当前提交到标签`vX.X.X`的所有改动，然后理解这些改动内容，写入`CHANGELOG.md`、同时修改`README.md`、`README.zh.md`、`examples/`内的使用demo。最后更新版本号，将所有改动放入git暂存区，不要提交。

在用户提到“发版”时，代表用户已经确认提交无误，此时你应该再次使用`npm pkg get version`查看版本号，然后在当前提交上使用`git tag vX.X.X`打标签，并将所有改动提交到远程仓库。包的构建、发布由Github Action自动完成。