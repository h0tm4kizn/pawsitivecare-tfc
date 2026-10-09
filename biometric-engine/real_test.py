#!/usr/bin/env python3
"""
Real Pet Identification Testing Script
Tests actual biometric identification accuracy per individual pet.
Accuracy = correct pet is the top match AND similarity score >= threshold.
"""
import os
import argparse
import requests
import json
from pathlib import Path


def test_individual_pet(image_path, api_url, pet_folder):
    """Test identification for a specific pet. Returns whether the correct pet matched."""
    try:
        with open(image_path, 'rb') as f:
            files = {'file': (image_path.name, f)}
            response = requests.post(f"{api_url}/scanning", files=files, timeout=30)

        if response.status_code == 200:
            result = response.json()
            best = result.get("best_match") or {}
            confidence = best.get("similarity_score", 0)
            identified_name = best.get("name", "")
            identified_path = best.get("image_path", "")
            threshold = float(result.get("threshold", 0.90))
            threshold_met = confidence >= threshold

            path_parts = {part.lower() for part in Path(identified_path).parts}
            correct_pet = identified_name.lower() == pet_folder.lower() or pet_folder.lower() in path_parts
            correct_and_confident = threshold_met and correct_pet

            return {
                "pet_folder": pet_folder,
                "success": True,
                "confidence": confidence,
                "identified_name": identified_name,
                "identified_path": identified_path,
                "threshold_met": threshold_met,
                "correct_pet": correct_pet,
                "correct_and_confident": correct_and_confident,
            }
        else:
            return {
                "pet_folder": pet_folder,
                "success": False,
                "error": f"API Error: {response.status_code}",
            }
    except Exception as e:
        return {
            "pet_folder": pet_folder,
            "success": False,
            "error": str(e),
        }


def _check_api(url, label):
    try:
        r = requests.get(url, timeout=5)
        return r.status_code == 200
    except Exception:
        return False


def test_species(api_url, data_path, prefix, label):
    print(f"\n{'='*60}")
    print(f"  {label}")
    print(f"{'='*60}")

    if not _check_api(api_url, label):
        print(f"  API not reachable at {api_url}. Start the server first.")
        return []

    results = []
    data_path = Path(data_path)

    for pet_dir in sorted(data_path.glob(f"{prefix}*")):
        if not pet_dir.is_dir():
            continue
        test_images = list((pet_dir / "test").glob("*.jpg")) + \
                      list((pet_dir / "test").glob("*.jpeg")) + \
                      list((pet_dir / "test").glob("*.png"))
        if not test_images:
            continue

        result = test_individual_pet(test_images[0], api_url, pet_dir.name)
        results.append(result)

        if result["success"]:
            conf = result["confidence"]
            identified = result["identified_name"] or result["identified_path"]
            correct = result["correct_pet"]
            threshold = result["threshold_met"]
            icon = "✅" if result["correct_and_confident"] else ("⚠️ " if threshold and not correct else "❌")
            print(f"  {icon} {pet_dir.name}: {conf:.1%}  →  identified as: {identified}")
            if not correct and threshold:
                print(f"       ^ Wrong pet identified!")
        else:
            print(f"  ❌ {pet_dir.name}: ERROR — {result.get('error')}")

    return results


def calculate_accuracy(results):
    if not results:
        return 0.0
    correct = sum(1 for r in results if r.get("correct_and_confident"))
    return correct / len(results)


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument(
        "--dog-data",
        default="dog-noseprint/dataset",
        help="Root containing dog*/test folders.",
    )
    parser.add_argument(
        "--cat-data",
        default="cat-facial-recog/dataset",
        help="Root containing cat*/test folders.",
    )
    args = parser.parse_args()

    print("PawsitiveCare — Real Biometric Identification Test")
    print("=" * 60)
    print("Accuracy = top match is correct pet AND score meets the API threshold")

    cat_results = test_species(
        api_url="http://127.0.0.1:8001",
        data_path=args.cat_data,
        prefix="cat",
        label="CAT FACIAL RECOGNITION",
    )
    dog_results = test_species(
        api_url="http://127.0.0.1:8000",
        data_path=args.dog_data,
        prefix="dog",
        label="DOG NOSEPRINT RECOGNITION",
    )

    cat_acc   = calculate_accuracy(cat_results)
    dog_acc   = calculate_accuracy(dog_results)
    all_results = cat_results + dog_results
    total     = len(all_results)

    # Identification rate — correct pet is top match (regardless of threshold)
    cat_id_correct = sum(1 for r in cat_results if r.get("correct_pet") and r.get("success"))
    dog_id_correct = sum(1 for r in dog_results if r.get("correct_pet") and r.get("success"))

    # Threshold rate — correct pet AND meets score threshold
    cat_thr_correct = sum(1 for r in cat_results if r.get("correct_and_confident"))
    dog_thr_correct = sum(1 for r in dog_results if r.get("correct_and_confident"))

    print(f"\n{'='*60}")
    print("SUMMARY")
    print(f"{'='*60}")
    print()
    print("  Identification Rate  (correct pet is top match):")
    print(f"    Cat : {cat_id_correct}/{len(cat_results)}  ({cat_id_correct/len(cat_results):.1%})" if cat_results else "    Cat : no results")
    print(f"    Dog : {dog_id_correct}/{len(dog_results)}  ({dog_id_correct/len(dog_results):.1%})" if dog_results else "    Dog : no results")
    print()
    print("  Threshold Rate  (correct pet AND score >= threshold):")
    print(f"    Cat : {cat_thr_correct}/{len(cat_results)}  ({cat_acc:.1%})" if cat_results else "    Cat : no results")
    print(f"    Dog : {dog_thr_correct}/{len(dog_results)}  ({dog_acc:.1%})" if dog_results else "    Dog : no results")
    if total:
        total_thr = cat_thr_correct + dog_thr_correct
        total_id  = cat_id_correct + dog_id_correct
        print()
        print(f"  Overall identification : {total_id}/{total}  ({total_id/total:.1%})")
        print(f"  Overall threshold met  : {total_thr}/{total}  ({total_thr/total:.1%})")

    total_correct = cat_thr_correct + dog_thr_correct
    output = {
        "cat_results": cat_results,
        "dog_results": dog_results,
        "summary": {
            "cat_accuracy": cat_acc,
            "dog_accuracy": dog_acc,
            "overall_accuracy": total_correct / total if total else 0,
            "total_tests": total,
        },
    }
    with open("real_test_results.json", "w") as f:
        json.dump(output, f, indent=2)
    print(f"\n  Detailed results saved to real_test_results.json")


if __name__ == "__main__":
    main()
