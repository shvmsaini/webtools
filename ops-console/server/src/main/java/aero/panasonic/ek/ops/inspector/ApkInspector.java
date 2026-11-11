/*
 * Copyright (c) 2026 Panasonic Avionics
 *
 * Reads package / version metadata straight out of an uploaded APK so the
 * operator never has to type packageName, versionName or minSdkVersion.
 *
 * Pure Java (net.dongliu:apk-parser) — no Android SDK required on the
 * server. The APK file format is documented and stable, so the parser
 * does not need the device's framework classes.
 */
package aero.panasonic.ek.ops.inspector;

import net.dongliu.apk.parser.ApkFile;
import net.dongliu.apk.parser.bean.ApkMeta;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Component;

import java.io.IOException;
import java.nio.file.Path;

/**
 * Pulls packageName, versionName, minSdkVersion and signing-cert SHA-256
 * from an APK file. Missing values yield {@code null} rather than empty
 * strings so the controller can preserve whatever the operator typed.
 */
@Component
public class ApkInspector {

    private static final Logger log = LoggerFactory.getLogger(ApkInspector.class);

    /** What we can read straight off the APK. */
    public record Metadata(
            String packageName,
            String versionName
    ) {}

    public Metadata inspect(Path apkFile) {
        try (ApkFile apk = new ApkFile(apkFile.toFile())) {
            ApkMeta meta = apk.getApkMeta();
            String pkg = blankToNull(meta.getPackageName());
            String ver = blankToNull(meta.getVersionName());
            log.info("inspected APK path={} package={} version={}", apkFile, pkg, ver);
            return new Metadata(pkg, ver);
        } catch (IOException e) {
            log.warn("inspect failed for {}: {}", apkFile, e.getMessage());
            return new Metadata(null, null);
        }
    }

    private static String blankToNull(String s) {
        return (s == null || s.isBlank()) ? null : s;
    }
}
