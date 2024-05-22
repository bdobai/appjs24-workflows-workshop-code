import {
  ConfigPlugin,
  withDangerousMod,
  IOSConfig,
} from "@expo/config-plugins";
import path from "path";
import fs from "fs";
import { globSync } from "glob";
import {
  PBXGroup,
  XcodeProject,
  PBXBuildFile,
  PBXFileReference,
  PBXSourcesBuildPhase,
  PBXFrameworksBuildPhase,
  PBXResourcesBuildPhase,
  PBXContainerItemProxy,
  PBXTargetDependency,
  PBXCopyFilesBuildPhase,
} from "@bacons/xcode";
import * as xcodeParse from "@bacons/xcode/json";
import {
  addFrameworksToDisplayFolder,
  createConfigurationList,
  getOrCreateBuildFile,
  getFramework,
  applyDevelopmentTeamIdToTargets,
} from "./apple-utils";

const createWidget = () => {};

const withIosWidget: ConfigPlugin = (config) => {
  return withDangerousMod(config, [
    "ios",
    (dangerousConfig) => {
      console.log("iOS widget!");
      // constants
      const widgetFolderName = "HelloWidget";
      const widgetBundleId =
        dangerousConfig.ios!.bundleIdentifier! + "." + "HelloWidget";
      const widgetExtensionFrameworks = ["WidgetKit", "SwiftUI"];
      const developmentTeamId = undefined;
      const projectRoot = dangerousConfig.modRequest.projectRoot;
      const widgetRoot = path.join(projectRoot, "widgets/ios/");
      const widgetFolderRelativeToIosProject = "../widgets/ios/";

      // Read the file pbxproj (file that holds the files + etc. for the project)
      const project = XcodeProject.open(
        IOSConfig.Paths.getPBXProjectPath(
          dangerousConfig.modRequest.projectRoot
        )
      );

      // ** BEGIN PBXPROJ MODIFICATIONS **

      // grab all swift files in the project, create refs with their basenames
      const swiftFiles = globSync("*.swift", {
        absolute: true,
        cwd: widgetRoot,
      }).map((file) => {
        return PBXBuildFile.create(project, {
          fileRef: PBXFileReference.create(project, {
            path: path.basename(file),
            sourceTree: "<group>",
          }),
        });
      });

      // do the same for the assets folder
      let assetFiles = ["*.xcassets"]
        .map((glob) =>
          globSync(glob, {
            absolute: true,
            cwd: widgetRoot,
          }).map((file) => {
            return PBXBuildFile.create(project, {
              fileRef: PBXFileReference.create(project, {
                path: path.basename(file),
                sourceTree: "<group>",
              }),
            });
          })
        )
        .flat();

      const group = PBXGroup.create(project, {
        name: widgetFolderName,
        sourceTree: "<group>",
        path: widgetFolderRelativeToIosProject,
        children: [
          // @ts-expect-error
          ...swiftFiles
            .map((buildFile) => buildFile.props.fileRef)
            .sort((a, b) =>
              a.getDisplayName().localeCompare(b.getDisplayName())
            ),
          // @ts-expect-error
          ...assetFiles
            .map((buildFile) => buildFile.props.fileRef)
            .sort((a, b) =>
              a.getDisplayName().localeCompare(b.getDisplayName())
            ),
          // you may have noticed we didn't create a file reference for this yet- we do it now inline
          // @ts-expect-error
          PBXFileReference.create(project, {
            path: "Info.plist",
            sourceTree: "<group>",
          }),
        ],
      });

      //add widget group to main group
      project.rootObject.props.mainGroup.props.children.unshift(group);

      // ** Display Frameworks **

      // Add the widget target to the display folder (cosmetic, makes it look like a normal Xcode project when you open it)
      addFrameworksToDisplayFolder(
        project,
        widgetExtensionFrameworks.map((framework) =>
          getFramework(project, framework)
        )
      );

      // this file is generated when the widget is built and put into the main target.
      const appexBuildFile = PBXBuildFile.create(project, {
        fileRef: PBXFileReference.create(project, {
          explicitFileType: "wrapper.app-extension",
          includeInIndex: 0,
          path: widgetFolderName + ".appex",
          sourceTree: "BUILT_PRODUCTS_DIR",
        }),
        settings: {
          ATTRIBUTES: ["RemoveHeadersOnCopy"],
        },
      });

      project.rootObject.ensureProductGroup().props.children.push(
        // @ts-expect-error
        appexBuildFile.props.fileRef
      );

      // ** Setup widget build target **

      const widgetTarget = project.rootObject.createNativeTarget({
        buildConfigurationList: createConfigurationList(project, {
          name: widgetFolderName,
          cwd: widgetFolderRelativeToIosProject,
          bundleId: widgetBundleId,
          deploymentTarget: "17.4",
          currentProjectVersion: "1",
        }),
        name: widgetFolderName,
        productName: widgetFolderName,
        // @ts-expect-error
        productReference: appexBuildFile.props.fileRef /* .appex */,
        productType: "com.apple.product-type.app-extension",
      });

      widgetTarget.createBuildPhase(PBXSourcesBuildPhase, {
        files: [...swiftFiles],
      });

      widgetTarget.createBuildPhase(PBXFrameworksBuildPhase, {
        files: widgetExtensionFrameworks.map((framework) =>
          getOrCreateBuildFile(project, getFramework(project, framework))
        ),
      });

      widgetTarget.createBuildPhase(PBXResourcesBuildPhase, {
        files: [...assetFiles],
      });

      const mainAppTarget = project.rootObject.getMainAppTarget("ios");

const containerItemProxy = PBXContainerItemProxy.create(project, {
  containerPortal: project.rootObject,
  proxyType: 1,
  remoteGlobalIDString: widgetTarget.uuid,
  remoteInfo: widgetFolderName,
});

const targetDependency = PBXTargetDependency.create(project, {
  target: widgetTarget,
  targetProxy: containerItemProxy,
});

// Add the target dependency to the main app, should be only one.
mainAppTarget!.props.dependencies.push(targetDependency);

// plug into build phases
mainAppTarget!.createBuildPhase(PBXCopyFilesBuildPhase, {
  dstSubfolderSpec: 13,
  buildActionMask: 2147483647,
  files: [appexBuildFile],
  name: "Embed Foundation Extensions",
  runOnlyForDeploymentPostprocessing: 0,
});

// optionally add the team (needed for testing on device)
// how to get team ID: https://help.graphy.com/hc/en-us/articles/6913285345053-iOS-How-to-find-Team-ID-for-Apple-Developer-Account
// const myDevelopmentTeamId =
//   developmentTeamId ??
//   mainAppTarget!.getDefaultBuildSetting("DEVELOPMENT_TEAM");
// applyDevelopmentTeamIdToTargets(project, myDevelopmentTeamId);

      // ** END PBXPROJ MODIFICATIONS **

      // Write back to the file
      const contents = xcodeParse.build(project.toJSON());
      if (contents.trim().length) {
        fs.writeFileSync(
          IOSConfig.Paths.getPBXProjectPath(projectRoot),
          contents
        );
      }

      return dangerousConfig; // Return the modified config
    },
  ]);
};

export default withIosWidget;
